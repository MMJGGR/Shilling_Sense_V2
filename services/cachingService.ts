
import { EnrichedMerchantInfo, Category } from '../types';

// Data structure for cached enrichment info
export interface EnrichedData {
    merchant: string;
    category: Category;
    enrichedInfo?: EnrichedMerchantInfo;
}

const CACHE_KEY = 'shilling-sense-merchant-cache';

// Use a Map for in-memory caching during a session for speed, and sync with localStorage.
let memoryCache: Map<string, EnrichedData> | null = null;

const getCache = (): Map<string, EnrichedData> => {
    if (memoryCache) {
        return memoryCache;
    }
    try {
        const storedCache = window.localStorage.getItem(CACHE_KEY);
        // If there's a stored cache, parse it; otherwise, start with an empty object.
        const parsedCache = storedCache ? JSON.parse(storedCache) : {};
        // Convert the plain object from localStorage back into a Map for use.
        memoryCache = new Map(Object.entries(parsedCache));
        return memoryCache;
    } catch (error) {
        console.error("Failed to load merchant cache from localStorage:", error);
        // In case of error (e.g., corrupted data), start with a fresh cache.
        memoryCache = new Map();
        return memoryCache;
    }
};

const persistCache = () => {
    if (memoryCache) {
        try {
            // Convert the in-memory Map to a plain object for JSON serialization.
            const objectToStore = Object.fromEntries(memoryCache);
            window.localStorage.setItem(CACHE_KEY, JSON.stringify(objectToStore));
        } catch (error) {
            console.error("Failed to save merchant cache to localStorage:", error);
        }
    }
};

/**
 * Retrieves cached enrichment data for a given key.
 * @param key The stable identifier for the cached data (e.g., a merchant name).
 * @returns The cached EnrichedData object or undefined if not found.
 */
export const getCachedEnrichment = (key: string): EnrichedData | undefined => {
    const cache = getCache();
    return cache.get(key);
};

/**
 * Stores enrichment data in the cache against a stable key.
 * @param key The stable identifier for the data to cache.
 * @param data The EnrichedData object to cache.
 */
export const setCachedEnrichment = (key: string, data: EnrichedData) => {
    const cache = getCache();
    cache.set(key, data);
    // Persist the updated cache to localStorage.
    persistCache();
};
