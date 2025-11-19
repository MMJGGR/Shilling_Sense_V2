
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { CategorizationExample, Category, EnrichedMerchantInfo, ParsedTransaction, Transaction, TransactionType, AppContextData } from "../types";
import { getCachedEnrichment, setCachedEnrichment } from './cachingService';
import { extractHeuristicData, extractPointsFromDescription } from "./heuristicService";
import { getCategoryForMerchant } from "./merchantCategoryMapService";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

// FIX: Added missing interfaces required for batch enrichment
export interface TransactionToEnrich {
    index: number;
    description: string;
    cacheKey: string;
    identifiedMerchant?: string;
}

export interface BatchEnrichmentResult {
    index: number;
    merchant: string;
    category: Category;
    enrichedInfo?: EnrichedMerchantInfo;
}

// --- OPTIMIZATION: RETRY LOGIC & CACHING ---

const validationCache = new Map<string, boolean>();

async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (retries === 0) throw error;
        console.warn(`AI Call failed, retrying in ${delay}ms...`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
        return retryWithBackoff(fn, retries - 1, delay * 2);
    }
}

const cleanJsonInfo = (text: string) => {
    try {
        let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const firstBrace = cleanText.indexOf('{');
        const lastBrace = cleanText.lastIndexOf('}');
        const firstBracket = cleanText.indexOf('[');
        const lastBracket = cleanText.lastIndexOf(']');

        if (firstBrace !== -1 && lastBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
             cleanText = cleanText.substring(firstBrace, lastBrace + 1);
        } else if (firstBracket !== -1 && lastBracket !== -1) {
             cleanText = cleanText.substring(firstBracket, lastBracket + 1);
        }
        
        return JSON.parse(cleanText);
    } catch (e) {
        console.error("JSON parsing failed for text:", text);
        throw new Error("Failed to parse AI response.");
    }
};

const fileToGenerativePart = (file: File) => {
  return new Promise<{ inlineData: { data: string; mimeType: string } }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== 'string') {
        return reject(new Error("Failed to read file as base64 string."));
      }
      const base64Data = reader.result.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

export const parseBasicInfoFromText = async (text: string): Promise<Pick<ParsedTransaction, 'amount' | 'description' | 'type'>> => {
    return retryWithBackoff(async () => {
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: `From the text "${text}", extract the amount (as a number), the full original description (like "Lipa na M-PESA to Naivas"), and the transaction type ('income' or 'expense').`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            amount: { type: Type.NUMBER },
                            description: { type: Type.STRING },
                            type: { type: Type.STRING, enum: ["income", "expense"] },
                        },
                        required: ["amount", "description", "type"]
                    }
                }
            });
            return cleanJsonInfo(response.text);
        } catch (error) {
            console.error("Error parsing basic info from text:", error);
            throw new Error("AI could not understand the transaction text. Please enter the details manually.");
        }
    });
};

export const parseTransactionsFromFile = async (file: File): Promise<ParsedTransaction[]> => {
  return retryWithBackoff(async () => {
      try {
        let response;
        const jsonConfig = {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        date: { type: Type.STRING, description: "YYYY-MM-DD format" },
                        description: { type: Type.STRING },
                        amount: { type: Type.NUMBER },
                        type: { type: Type.STRING, enum: ["income", "expense"] }
                    },
                    required: ["date", "description", "amount", "type"]
                }
            }
        };

        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
            const csvText = await file.text();
            const combinedPrompt = `Analyze this CSV content representing a financial statement from Kenya.
    - Debit column = expense.
    - Credit column = income.
    - Extract strictly valid JSON.
    CSV Content:
    ---
    ${csvText}
    ---`;
            
            response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: combinedPrompt,
                config: jsonConfig
            });
        } else {
            const filePart = await fileToGenerativePart(file);
            const promptAction = `You are a specialized financial parser for Kenyan M-PESA and Bank statements. 
            Analyze the provided image/document.
            M-PESA PARSING RULES:
            1. "Paid In" = INCOME, "Withdrawn" = EXPENSE.
            2. IGNORE "Balance".
            3. Convert "Completion Time" to YYYY-MM-DD.
            Output a JSON Array of transactions.`;

            response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [ filePart, { text: promptAction } ] },
                config: jsonConfig
            });
        }

        return cleanJsonInfo(response.text);
      } catch (error) {
        console.error("Error parsing transactions from file:", error);
        throw new Error("AI failed to process the statement. Please ensure it's a clear document and in a supported format.");
      }
  });
};

export const enrichTransaction = async (transaction: ParsedTransaction, examples: CategorizationExample[]): Promise<ParsedTransaction & { enrichedInfo?: EnrichedMerchantInfo }> => {
    const { merchant: identifiedMerchant, cacheKey } = extractHeuristicData(transaction.description);
    
    if (identifiedMerchant) {
        const mappedCategory = getCategoryForMerchant(identifiedMerchant);
        if (mappedCategory) {
            return { ...transaction, merchant: identifiedMerchant, category: mappedCategory };
        }
    }

    const cachedData = getCachedEnrichment(cacheKey);
    if (cachedData) {
        const merchant = identifiedMerchant || cachedData.merchant;
        return { ...transaction, ...cachedData, merchant };
    }
    
    // Optimization: If it's a very common low-value transaction with no heuristic match, maybe skip enriched info?
    // For now, we use backoff to ensure reliability.

    return retryWithBackoff(async () => {
        try {
            const task = identifiedMerchant ? 'categorize' : 'enrich';
            const merchantInfo = identifiedMerchant ? `The merchant is "${identifiedMerchant}".` : '';

            const prompt = `For the transaction description "${transaction.description}", perform this task: "${task}". ${merchantInfo}
    - Step 1: If task is "enrich", infer the merchant name.
    - Step 2: Use Google Search to understand the business type.
    - Step 3: Select the most suitable category.
    - Use these examples: ${JSON.stringify(examples)}.
    - Respond ONLY with a valid JSON object (no markdown) with keys "merchant", "category", and optional "enrichedInfo".`;
            
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    tools: [{googleSearch: {}}],
                }
            });
            
            const enrichedData = cleanJsonInfo(response.text);
            let finalData: ParsedTransaction & { enrichedInfo?: EnrichedMerchantInfo } = { ...transaction, ...enrichedData };
            
            if (!finalData.enrichedInfo) {
                const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
                if(groundingChunks && groundingChunks.length > 0) {
                    const firstWebResult = groundingChunks.find(c => c.web);
                    if (firstWebResult && firstWebResult.web) {
                        finalData.enrichedInfo = {
                            officialName: firstWebResult.web.title || enrichedData.merchant,
                            website: firstWebResult.web.uri || '',
                        };
                    }
                }
            }
            
            setCachedEnrichment(cacheKey, {
                merchant: finalData.merchant || 'Unknown',
                category: finalData.category || 'Other',
                enrichedInfo: finalData.enrichedInfo
            });

            return finalData;

        } catch (error) {
            console.error("Error enriching transaction:", error);
            return { ...transaction, merchant: identifiedMerchant || 'Unknown', category: 'Other' };
        }
    });
};

export const batchEnrichTransactions = async (
    transactions: TransactionToEnrich[],
    examples: CategorizationExample[]
): Promise<BatchEnrichmentResult[]> => {
    if (transactions.length === 0) return [];
    
    return retryWithBackoff(async () => {
        try {
            const transactionsToProcess = transactions.map(t => ({
                index: t.index,
                description: t.description,
                task: t.identifiedMerchant ? 'categorize' : 'enrich',
                merchant: t.identifiedMerchant,
            }));
            
            const prompt = `Process this list of Kenyan transactions.
    - Use Google Search to identify business types.
    - Assign categories based on examples: ${JSON.stringify(examples)}
    - Input: ${JSON.stringify(transactionsToProcess)}
    - Output: JSON Array with "index", "merchant", "category", "enrichedInfo".`;

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }],
                }
            });

            const results: BatchEnrichmentResult[] = cleanJsonInfo(response.text);
            results.forEach(result => {
                const originalTx = transactions.find(t => t.index === result.index);
                if (originalTx) {
                    setCachedEnrichment(originalTx.cacheKey, {
                        merchant: result.merchant,
                        category: result.category,
                        enrichedInfo: result.enrichedInfo
                    });
                }
            });
            return results;

        } catch (error) {
            console.error("Error in batch enriching transactions:", error);
            return transactions.map(t => ({
                index: t.index,
                merchant: t.identifiedMerchant || 'Unknown',
                category: 'Other'
            }));
        }
    });
};

export const suggestTransferPairs = async (transactions: Transaction[]): Promise<Transaction[][]> => {
    const recentTxs = [...transactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 100)
        .filter(t => !t.isTransfer);

    if (recentTxs.length < 2) return [];

    return retryWithBackoff(async () => {
        try {
            const simplifiedTxs = recentTxs.map(t => ({ id: t.id, date: t.date, amount: t.amount, type: t.type, description: t.description }));
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: `Find transfer pairs (same amount, income/expense, close dates). Txs: ${JSON.stringify(simplifiedTxs)}.`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.ARRAY,
                            items: { 
                                type: Type.OBJECT,
                                properties: { id: { type: Type.STRING } }
                            }
                        }
                    }
                }
            });
            // Map back to full transaction objects
            const pairsIds: {id: string}[][] = cleanJsonInfo(response.text);
            return pairsIds.map(pair => 
                pair.map(p => recentTxs.find(t => t.id === p.id)).filter((t): t is Transaction => !!t)
            );
        } catch (error) {
            console.error("Error suggesting transfer pairs:", error);
            return [];
        }
    });
};

export const validateCategoryMismatch = async (description: string, newCategory: Category): Promise<boolean> => {
    const cacheKey = `${description.trim().toLowerCase()}|${newCategory.toLowerCase()}`;
    if (validationCache.has(cacheKey)) {
        return validationCache.get(cacheKey)!;
    }

    // Optimization: Don't call AI for "Other" or simple corrections
    if (newCategory === 'Other' || newCategory === 'General') return true;

    return retryWithBackoff(async () => {
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: `User categorized "${description}" as "${newCategory}". Is this logical? JSON { "is_logical": boolean }`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: { is_logical: { type: Type.BOOLEAN } },
                        required: ["is_logical"]
                    }
                }
            });
            const result = cleanJsonInfo(response.text);
            validationCache.set(cacheKey, result.is_logical);
            return result.is_logical;
        } catch (error) {
            console.error("Error validating category mismatch:", error);
            return true; 
        }
    }, 1); // Only retry once for validation, it's non-critical
};

export const createFinancialChatSession = (context: AppContextData): Chat => {
    const txContext = context.transactions.slice(0, 150).map(t => ({
        d: t.date,
        m: t.merchant,
        a: t.amount,
        t: t.type,
        c: t.category,
    }));

    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: `You are 'Shilling Sense AI', a Kenyan financial assistant. 
            Currency: KES.
            Context:
            - Transactions (recent): ${JSON.stringify(txContext)}
            - Loyalty: ${JSON.stringify(context.loyaltyCards)}
            - Debts: ${JSON.stringify(context.debts)}
            - Chamas: ${JSON.stringify(context.chamas)}
            
            Be helpful, concise, and proactive.`,
        }
    });
};
