import { Category } from '../types';

interface CategoryRule {
  keywords: string[];
  category: Category;
}

// A curated list of common merchants and keywords in Kenya.
// This list can be expanded over time.
const categoryRules: CategoryRule[] = [
  { keywords: ['naivas', 'carrefour', 'quickmart', 'chandarana', 'cleanshelf'], category: 'Groceries' },
  { keywords: ['kplc', 'kenya power', 'prepaid', 'postpaid'], category: 'Utilities' },
  { keywords: ['zuku', 'safaricom home', 'faiba'], category: 'Utilities' },
  { keywords: ['nairobi water', 'nwsc'], category: 'Utilities' },
  { keywords: ['java', 'artcaffe', 'kfc', 'dominos', 'pizza inn', 'chicken inn'], category: 'Eating Out' },
  { keywords: ['uber', 'bolt', 'little cab'], category: 'Transport' },
  { keywords: ['total', 'shell', 'rubis', 'ola'], category: 'Transport' },
  { keywords: ['equity', 'kcb', 'co-op', 'coop', 'standard chartered', 'stanchart', 'absia'], category: 'Internal Transfer' },
  { keywords: ['nhif'], category: 'Health' },
  { keywords: ['gotv', 'dstv', 'netflix'], category: 'Entertainment' },
  { keywords: ['jumia', 'kilimall'], category: 'Shopping' },
];

/**
 * Gets a category for a merchant name based on a predefined set of rules.
 * This is a fast, on-device lookup.
 * @param merchantName The name of the merchant extracted from heuristics.
 * @returns A category if a rule matches, otherwise null.
 */
export const getCategoryForMerchant = (merchantName: string): Category | null => {
  const lowerCaseMerchant = merchantName.toLowerCase();
  for (const rule of categoryRules) {
    for (const keyword of rule.keywords) {
      if (lowerCaseMerchant.includes(keyword)) {
        return rule.category;
      }
    }
  }
  return null;
};
