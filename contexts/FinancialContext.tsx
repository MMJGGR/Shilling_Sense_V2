
import React, { createContext, useContext, useCallback, useState, ReactNode, useEffect } from 'react';
import { Account, Transaction, Category, Budget, UserProfile, LoyaltyCard, Debt, Chama, CategorizationExample, TransactionType } from '../types';
import useLocalStorage from '../hooks/useLocalStorage';
import { DEFAULT_CATEGORIES } from '../constants';
import { validateCategoryMismatch } from '../services/geminiService';
import { extractPointsFromDescription } from '../services/heuristicService';

interface FinancialContextType {
    accounts: Account[];
    transactions: Transaction[];
    categories: Category[];
    budgets: Budget[];
    userProfile: UserProfile | null;
    loyaltyCards: LoyaltyCard[];
    debts: Debt[];
    chamas: Chama[];
    categorizationExamples: CategorizationExample[];
    
    setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
    setBudgets: React.Dispatch<React.SetStateAction<Budget[]>>;
    setLoyaltyCards: React.Dispatch<React.SetStateAction<LoyaltyCard[]>>;
    setDebts: React.Dispatch<React.SetStateAction<Debt[]>>;
    setChamas: React.Dispatch<React.SetStateAction<Chama[]>>;
    setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
    
    addTransaction: (tx: Omit<Transaction, 'id'>) => void;
    updateTransaction: (tx: Transaction) => void;
    deleteTransaction: (id: string) => void;
    updateCategory: (txId: string, newCategory: Category) => void;
    importTransactions: (txs: Omit<Transaction, 'id'>[]) => void;
    addBudget: (budgets: Omit<Budget, 'id'> | Omit<Budget, 'id'>[]) => void;
    
    notification: { message: string; show: boolean; type?: 'info' | 'warning' };
    dismissNotification: () => void;
}

const FinancialContext = createContext<FinancialContextType | undefined>(undefined);

export const FinancialProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // State Storage
    const [accounts, setAccounts] = useLocalStorage<Account[]>('accounts', []);
    const [transactions, setTransactions] = useLocalStorage<Transaction[]>('transactions', []);
    const [categories, setCategories] = useLocalStorage<Category[]>('categories', DEFAULT_CATEGORIES);
    const [budgets, setBudgets] = useLocalStorage<Budget[]>('budgets', []);
    const [userProfile, setUserProfile] = useLocalStorage<UserProfile | null>('userProfile', null);
    const [loyaltyCards, setLoyaltyCards] = useLocalStorage<LoyaltyCard[]>('loyaltyCards', []);
    const [debts, setDebts] = useLocalStorage<Debt[]>('debts', []);
    const [chamas, setChamas] = useLocalStorage<Chama[]>('chamas', []);
    const [categorizationExamples, setCategorizationExamples] = useLocalStorage<CategorizationExample[]>('categorizationExamples', []);
    
    // FIX: Explicitly typed the useState hook for notification to allow 'warning' type assignment.
    const [notification, setNotification] = useState<{ message: string; show: boolean; type: 'info' | 'warning' }>({ message: '', show: false, type: 'info' });

    const showToast = (message: string, type: 'info' | 'warning' = 'info') => {
        setNotification({ message, show: true, type });
    };

    const dismissNotification = () => setNotification(prev => ({ ...prev, show: false }));

    // Logic: Loyalty Points
    const checkAndAddPoints = useCallback((transaction: Omit<Transaction, 'id'>) => {
        const extractedPoints = extractPointsFromDescription(transaction.description);
        if (extractedPoints) {
            const providerName = transaction.merchant;
            setLoyaltyCards(prev => {
                const existingIndex = prev.findIndex(c => c.provider.toLowerCase() === providerName.toLowerCase());
                if (existingIndex >= 0) {
                    const updated = [...prev];
                    updated[existingIndex] = {
                        ...updated[existingIndex],
                        points: extractedPoints,
                        lastUpdated: new Date().toISOString().split('T')[0]
                    };
                    return updated;
                } else {
                    return [...prev, {
                        id: Date.now().toString(),
                        provider: providerName,
                        points: extractedPoints,
                        lastUpdated: new Date().toISOString().split('T')[0]
                    }];
                }
            });
            return true;
        }
        return false;
    }, [setLoyaltyCards]);

    // Logic: Add Transaction
    const addTransaction = useCallback((transactionData: Omit<Transaction, 'id'>) => {
        const newTransaction: Transaction = { ...transactionData, id: Date.now().toString() };
        setTransactions(prev => [...prev, newTransaction]);
        checkAndAddPoints(newTransaction);
        
        if (transactions.length === 0) {
            showToast("Achievement Unlocked: First transaction logged!", 'info');
        }
    }, [setTransactions, transactions.length, checkAndAddPoints]);

    // Logic: Update Transaction
    const updateTransaction = useCallback((updatedTransaction: Transaction) => {
        setTransactions(prev => prev.map(t => t.id === updatedTransaction.id ? updatedTransaction : t));
    }, [setTransactions]);

    const deleteTransaction = useCallback((id: string) => {
        setTransactions(prev => prev.filter(t => t.id !== id));
    }, [setTransactions]);

    // Logic: Optimistic Category Update
    const updateCategory = useCallback(async (transactionId: string, newCategory: Category) => {
        const transaction = transactions.find(t => t.id === transactionId);
        if (!transaction) return;

        // 1. OPTIMISTIC UPDATE: Update UI immediately
        setTransactions(prev => prev.map(t => t.id === transactionId ? { ...t, category: newCategory, isTransfer: newCategory === 'Internal Transfer' } : t));
        
        if (!categories.includes(newCategory)) {
            setCategories(prev => [...prev, newCategory].sort());
        }

        // 2. BACKGROUND VALIDATION
        try {
            const isLogical = await validateCategoryMismatch(transaction.description, newCategory);
            if (isLogical) {
                // Update training data silently
                setCategorizationExamples(prev => [...prev, { description: transaction.description, category: newCategory }]);
            } else {
                // Notify user if AI thinks it's wrong, but don't revert automatically
                showToast(`Tip: AI thinks "${newCategory}" might be unusual for this.`, 'warning');
            }
        } catch (e) {
            // Ignore validation errors
        }
    }, [transactions, categories, setTransactions, setCategories, setCategorizationExamples]);

    // Logic: Import
    const importTransactions = useCallback((importedTransactions: Omit<Transaction, 'id'>[]) => {
        const existingTxKeys = new Set(transactions.map(t => `${t.date}|${t.description.trim()}|${t.amount}|${t.type}|${t.accountId}`));

        const uniqueImportedTransactions = importedTransactions.filter(t => {
            const key = `${t.date}|${t.description.trim()}|${t.amount}|${t.type}|${t.accountId}`;
            return !existingTxKeys.has(key);
        });

        const skippedCount = importedTransactions.length - uniqueImportedTransactions.length;
        
        if (uniqueImportedTransactions.length > 0) {
            const newTransactions: Transaction[] = uniqueImportedTransactions.map((t, i) => ({ ...t, id: `${Date.now()}-${i}`}));
            setTransactions(prev => [...prev, ...newTransactions]);

            let pointsFound = 0;
            newTransactions.forEach(tx => {
                if(checkAndAddPoints(tx)) pointsFound++;
            });

            const importedCategories = new Set(uniqueImportedTransactions.map(t => t.category));
            const newCategories = Array.from(importedCategories).filter(cat => !categories.includes(cat));
            if (newCategories.length > 0) {
                setCategories(prev => [...prev, ...newCategories].sort());
            }
            
            const pointsMsg = pointsFound > 0 ? ` & updated ${pointsFound} loyalty cards` : '';
            showToast(`${newTransactions.length} imported${pointsMsg}. ${skippedCount > 0 ? skippedCount + ' skipped.' : ''}`, 'info');
        } else if (skippedCount > 0) {
            showToast("All transactions were duplicates.", 'warning');
        }
    }, [transactions, categories, setTransactions, setCategories, checkAndAddPoints]);

    // Logic: Budgets
    const addBudget = useCallback((budgetOrBudgets: Omit<Budget, 'id'> | Omit<Budget, 'id'>[]) => {
        const newBudgets = Array.isArray(budgetOrBudgets) ? budgetOrBudgets : [budgetOrBudgets];
        setBudgets(prev => {
            const updated = [...prev];
            newBudgets.forEach(newB => {
                const idx = updated.findIndex(b => b.category === newB.category);
                if (idx >= 0) {
                    updated[idx] = { ...newB, id: updated[idx].id };
                } else {
                    updated.push({ ...newB, id: Date.now().toString() + Math.random() });
                }
            });
            return updated;
        });
        showToast("Budget Strategy Updated", 'info');
    }, [setBudgets]);

    return (
        <FinancialContext.Provider value={{
            accounts, transactions, categories, budgets, userProfile, loyaltyCards, debts, chamas, categorizationExamples,
            setAccounts, setTransactions, setUserProfile, setBudgets, setLoyaltyCards, setDebts, setChamas, setCategories,
            addTransaction, updateTransaction, deleteTransaction, updateCategory, importTransactions, addBudget,
            notification, dismissNotification
        }}>
            {children}
        </FinancialContext.Provider>
    );
};

export const useFinancialContext = () => {
    const context = useContext(FinancialContext);
    if (!context) {
        throw new Error("useFinancialContext must be used within a FinancialProvider");
    }
    return context;
};
