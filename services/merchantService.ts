import { Transaction } from '../types';

const GOOGLE_API_KEY = process.env.API_KEY || '';
const GOOGLE_CX = ''; // TODO: User needs to provide this

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

    public getEnrichedName(rawName: string): string {
        return this.dictionary[rawName] || rawName;
    }

    public async identifyMerchants(transactions: Transaction[]): Promise<void> {
        if (!GOOGLE_API_KEY || !GOOGLE_CX) {
            console.warn('Merchant Identification: Missing API Key or CX ID.');
            return;
        }

        // 1. Identify unique unknown merchants
        const unknownMerchants = new Set<string>();
        transactions.forEach(t => {
            if (!this.dictionary[t.merchant] && !this.pendingSearches.has(t.merchant)) {
                // Simple heuristic: if name is very short or looks like a code, add to search
                // For now, we search everything that isn't in the dictionary
                unknownMerchants.add(t.merchant);
            }
        });

        const queue = Array.from(unknownMerchants);
        if (queue.length === 0) return;

        console.log(`Merchant Identification: Found ${queue.length} unknown merchants.`);

        // 2. Process in batches to respect rate limits and UI performance
        // Google Custom Search Free Tier: 100 queries / day.
        // We should be conservative.
        const BATCH_SIZE = 5;

        for (let i = 0; i < queue.length; i += BATCH_SIZE) {
            const batch = queue.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(rawName => this.searchAndCache(rawName)));

            // Small delay between batches
            if (i + BATCH_SIZE < queue.length) {
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
            } else {
                // If search failed or returned nothing, maybe mark as "checked" to avoid re-searching?
                // For now, we just leave it.
            }
        } catch (error) {
            console.error(`Failed to identify merchant: ${rawName}`, error);
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
