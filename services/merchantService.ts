import { Transaction } from '../types';

const GOOGLE_API_KEY = process.env.API_KEY || '';
const GOOGLE_CX = 'e36384b8e40a34109'; // User provided CX ID

interface MerchantDictionary {
    [rawName: string]: string;
}

const STORAGE_KEY = 'merchant_dictionary';

class MerchantService {
    private dictionary: MerchantDictionary = {};
    private isInitialized = false;
    private pendingSearches: Set<string> = new Set();

    constructor() {
        this.loadDictionary();
    }

    private loadDictionary() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                this.dictionary = JSON.parse(stored);
            }
        } catch (e) {
            console.error('Failed to load merchant dictionary', e);
        }
        this.isInitialized = true;
    }

    private saveDictionary() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.dictionary));
        } catch (e) {
            console.error('Failed to save merchant dictionary', e);
        }
    }

    private listeners: Set<(rawName: string, enrichedName: string) => void> = new Set();

    public subscribe(listener: (rawName: string, enrichedName: string) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notifyListeners(rawName: string, enrichedName: string) {
        this.listeners.forEach(listener => listener(rawName, enrichedName));
    }

    public getEnrichedName(rawName: string): string {
        return this.dictionary[rawName] || rawName;
    }

    public async identifyMerchants(transactions: Transaction[]): Promise<void> {
        if (!GOOGLE_API_KEY || !GOOGLE_CX) {
            console.warn('Merchant Identification: Missing API Key or CX ID.');
            return;
        }

        // Import heuristic extraction
        const { extractHeuristicData } = await import('./heuristicService');

        // 1. Extract merchants using regex first, identify which need API search
        const merchantsToSearch = new Map<string, string>(); // cleaned name -> raw description

        transactions.forEach(t => {
            // Skip if already in dictionary or pending
            if (this.dictionary[t.merchant] || this.pendingSearches.has(t.merchant)) {
                return;
            }

            // Detect P2P transfers (phone-to-phone, no real merchant)
            const isP2PTransfer = /IBKG MPESA PAY TO \d{12}|MPESA TO ACC|MOBILE MONEY/.test(t.description || t.merchant);
            if (isP2PTransfer) {
                // Cache as "Mobile Money Transfer" and skip search
                this.dictionary[t.merchant] = 'Mobile Money Transfer';
                this.saveDictionary();
                this.notifyListeners(t.merchant, 'Mobile Money Transfer');
                return;
            }

            // Try heuristic extraction first
            const { merchant: extractedMerchant } = extractHeuristicData(t.description || t.merchant);

            if (extractedMerchant) {
                // Check if extracted merchant is already in dictionary
                if (!this.dictionary[extractedMerchant]) {
                    // Only search if it looks like it needs cleanup (has weird chars, numbers, etc)
                    if (/[*\d]{2,}|PENDING|TXN|TILL/.test(extractedMerchant)) {
                        merchantsToSearch.set(extractedMerchant, t.description);
                    } else {
                        // Already clean enough, just cache it
                        this.dictionary[t.merchant] = extractedMerchant;
                        this.saveDictionary();
                        this.notifyListeners(t.merchant, extractedMerchant);
                    }
                } else {
                    // Use cached version
                    this.dictionary[t.merchant] = this.dictionary[extractedMerchant];
                    this.notifyListeners(t.merchant, this.dictionary[extractedMerchant]);
                }
            } else {
                // No regex match, check if it's a fee/charge (not worth searching)
                const isFeeOrCharge = /EXCISE DUTY|CHARGE|PAYMENT OF \d+|CORR\.|REV-/.test(t.description || t.merchant);
                if (isFeeOrCharge) {
                    // Cache as-is and skip search
                    this.dictionary[t.merchant] = t.merchant;
                    this.saveDictionary();
                    return;
                }

                // Will need Google Search
                merchantsToSearch.set(t.merchant, t.description);
            }
        });

        const queue = Array.from(merchantsToSearch.entries());
        if (queue.length === 0) {
            console.log('Merchant Identification: All merchants identified via regex!');
            return;
        }

        console.log(`Merchant Identification: ${queue.length} merchants need Google Search (${transactions.length - queue.length} identified via regex).`);

        // 2. Process in batches to respect rate limits
        // Google Custom Search Free Tier: 100 queries / day
        const BATCH_SIZE = 5;
        const MAX_SEARCHES = 50; // Safety limit

        const limitedQueue = queue.slice(0, MAX_SEARCHES);
        if (queue.length > MAX_SEARCHES) {
            console.warn(`Limiting searches to ${MAX_SEARCHES} to preserve API quota. ${queue.length - MAX_SEARCHES} merchants will use raw names.`);
        }

        for (let i = 0; i < limitedQueue.length; i += BATCH_SIZE) {
            const batch = limitedQueue.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(([merchantName, _description]) => this.searchAndCache(merchantName)));

            // Delay between batches
            if (i + BATCH_SIZE < limitedQueue.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    private async searchAndCache(rawName: string): Promise<void> {
        this.pendingSearches.add(rawName);
        try {
            const enrichedName = await this.searchMerchant(rawName);
            if (enrichedName) {
                this.dictionary[rawName] = enrichedName;
                this.saveDictionary();
                this.notifyListeners(rawName, enrichedName);
            } else {
                // If search failed or returned nothing, maybe mark as "checked" to avoid re-searching?
                // For now, we just leave it.
            }
        } catch (error) {
            console.error(`Failed to identify merchant: ${rawName} `, error);
        } finally {
            this.pendingSearches.delete(rawName);
        }
    }

    private async searchMerchant(query: string): Promise<string | null> {
        try {
            // Construct search query: "merchant name kenya" or similar context
            const q = `${query} kenya merchant`;
            const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(q)}&num=1`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.items && data.items.length > 0) {
                const result = data.items[0];
                // Return the title of the first result, or snippet?
                // Usually the title is the business name.
                // We might need to clean it up.
                return result.title.split('-')[0].split('|')[0].trim();
            }
            return null;
        } catch (error) {
            console.error('Google Search API Error:', error);
            return null;
        }
    }
}

export const merchantService = new MerchantService();
