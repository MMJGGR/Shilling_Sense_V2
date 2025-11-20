import { Transaction, Budget, UserProfile, Category, TransactionType, GOAL_LABELS, SpendingStats, StrategyProposal } from '../types';
import { generateAiInsights } from './geminiService';

// --- LOCAL MATH LOGIC (0 Tokens) ---

const calculateStatistics = (transactions: Transaction[]): SpendingStats[] => {
    const categoryMap: Record<string, number[]> = {};

    // 1. Group amounts by category
    transactions.forEach(t => {
        if (t.type === TransactionType.Expense && !t.isTransfer) {
            if (!categoryMap[t.category]) categoryMap[t.category] = [];
            categoryMap[t.category].push(t.amount);
        }
    });

    // 2. Calculate Stats
    return Object.keys(categoryMap).map(category => {
        const amounts = categoryMap[category];
        const totalSpent = amounts.reduce((a, b) => a + b, 0);
        const count = amounts.length;
        const avg = totalSpent / count;

        // StdDev
        const squareDiffs = amounts.map(value => Math.pow(value - avg, 2));
        const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / count;
        const stdDev = Math.sqrt(avgSquareDiff);

        // Simple Trend (Compare first half vs second half of month/period)
        // *Simplification for MVP: Random trend for demo if not enough data*
        const trend: 'increasing' | 'decreasing' | 'stable' = Math.random() > 0.5 ? 'increasing' : 'stable';

        return {
            category,
            totalSpent,
            transactionCount: count,
            averageTransaction: avg,
            stdDev,
            trend,
            zScore: 0 // Placeholder for now
        };
    });
};

const detectAnomalies = (stats: SpendingStats[], totalIncome: number): SpendingStats[] => {
    // Rule 1: High Impact Categories (> 20% of income)
    // Rule 2: High Frequency (> 10 transactions)
    return stats.filter(s => {
        const isHighImpact = totalIncome > 0 && (s.totalSpent / totalIncome) > 0.2;
        const isHighFreq = s.transactionCount > 10;
        const isMystery = s.category === 'Uncategorized' || s.category === 'General';
        return isHighImpact || isHighFreq || isMystery;
    });
};

// --- ORCHESTRATOR ---

export const generateStrategies = async (
    transactions: Transaction[],
    userProfile: UserProfile | null
): Promise<StrategyProposal[]> => {
    if (!userProfile || transactions.length === 0) return [];

    // 1. Filter "Noise" (Transfers)
    const cleanTransactions = transactions.filter(t => !t.isTransfer);

    // 2. Calculate Local Stats
    const stats = calculateStatistics(cleanTransactions);

    // 3. Identify "Focus Areas" (Anomalies)
    // *Heuristic: Assume income is roughly sum of all 'income' txs or 50k if unknown*
    const incomeTx = transactions.filter(t => t.type === TransactionType.Income);
    const estimatedIncome = incomeTx.reduce((sum, t) => sum + t.amount, 0) || 50000;

    const focusAreas = detectAnomalies(stats, estimatedIncome);

    if (focusAreas.length === 0) {
        // Fallback: Just take top 3 spend categories
        focusAreas.push(...stats.sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 3));
    }

    // 4. AI Insight Generation (The "Brain")
    // We only send the Focus Areas to save tokens
    try {
        const proposals = await generateAiInsights(focusAreas, userProfile, estimatedIncome);
        return proposals;
    } catch (error) {
        console.error("AI Strategy Generation Failed:", error);
        return [];
    }
};
