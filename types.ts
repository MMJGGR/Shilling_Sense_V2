

// FIX: Changed Category from an enum to a string type to allow for user-defined categories.
export type Category = string;

export enum TransactionType {
  Expense = "expense",
  Income = "income",
}

export enum AccountType {
  MobileMoney = "Mobile Money",
  BankAccount = "Bank Account",
  Cash = "Cash",
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  initialBalance: number;
}

export interface Transaction {
  id:string;
  accountId: string;
  date: string;
  merchant: string;
  amount: number;
  type: TransactionType;
  category: Category;
  description: string;
  logoUrl?: string;
  isTransfer?: boolean;
}

export interface CategorizationExample {
  description: string;
  category: Category;
}

export interface ParsedTransaction {
  merchant?: string;
  amount: number;
  category?: Category;
  type: TransactionType;
  date: string; // YYYY-MM-DD
  description: string;
}

export interface EnrichedMerchantInfo {
    officialName: string;
    website: string;
}

// --- NEW FEATURES TYPES ---

export interface LoyaltyCard {
    id: string;
    provider: string; // e.g., Safaricom (Bonga), Naivas, Carrefour
    points: number;
    lastUpdated: string;
}

export interface Debt {
    id: string;
    person: string; // e.g. "John Kamau"
    amount: number;
    type: 'owed_to_me' | 'owed_by_me';
    dueDate?: string;
    description?: string;
}

export interface Chama {
    id: string;
    name: string;
    myContribution: number; // Total contributed by user
    nextMeetingDate?: string;
    payoutDate?: string;
    cycleTotal: number; // Target pot size
}

// --- STRATEGIC PLANNING TYPES ---

export type FinancialGoal = 'save_emergency' | 'pay_debt' | 'invest' | 'buy_asset' | 'travel' | 'control_spend';

export const GOAL_LABELS: Record<FinancialGoal, string> = {
    save_emergency: 'Build Emergency Fund',
    pay_debt: 'Pay Off Debt',
    invest: 'Grow Investments',
    buy_asset: 'Buy Home/Car',
    travel: 'Save for Travel',
    control_spend: 'Control Spending'
};

export interface UserProfile {
    name: string;
    age: number;
    primaryGoal: FinancialGoal;
    targetAmount?: number;
    targetDate?: string;
    joinedDate: string;
}

export type BudgetStrategy = 'aggressive' | 'moderate' | 'maintain' | 'increase' | 'custom';

export interface Budget {
    id: string;
    category: Category;
    limit: number;
    period: 'monthly';
    strategy: BudgetStrategy;
}

export interface AppContextData {
    transactions: Transaction[];
    loyaltyCards: LoyaltyCard[];
    debts: Debt[];
    chamas: Chama[];
}