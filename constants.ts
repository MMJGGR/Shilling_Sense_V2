

import { Category } from './types';

// FIX: Renamed to DEFAULT_CATEGORIES and converted to string literals to provide a default set for new users.
export const DEFAULT_CATEGORIES: Category[] = [
  "Groceries",
  "Transport",
  "Eating Out",
  "Utilities",
  "Rent",
  "Shopping",
  "Entertainment",
  "Health",
  "Income",
  "Internal Transfer",
  "Investments",
  "Savings",
  "Other",
];

export const DISCRETIONARY_CATEGORIES: string[] = [
  "Eating Out",
  "Entertainment",
  "Shopping",
  "Personal Care",
  "Gifts",
  "Travel",
  "Subscriptions",
  "Alcohol & Bars",
  "Betting",
  "Ride Sharing/Food Delivery"
];

export const SAVINGS_CATEGORIES: string[] = [
  "Savings",
  "Investments",
  "Emergency Fund",
  "Sacco",
  "Money Market Fund",
  "Pension",
  "Financial Services/Investments"
];