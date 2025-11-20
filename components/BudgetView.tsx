
import React, { useMemo, useState } from 'react';
import { Budget, Transaction, TransactionType, UserProfile, GOAL_LABELS, StrategyProposal } from '../types';
import StrategyCard from './StrategyCard';
import Button from './ui/Button';
import { Plus, Target, Sparkles, Loader2 } from 'lucide-react';
import { generateStrategies } from '../services/strategyService';
import { useFinancialContext } from '../contexts/FinancialContext';

interface BudgetViewProps {
    budgets: Budget[];
    transactions: Transaction[];
    userProfile: UserProfile | null;
    onDelete: (id: string) => void;
    onAddBudget: (budget: Omit<Budget, 'id'>) => void;
    onEdit: () => void;
    onClearAll: () => void;
}

const BudgetView: React.FC<BudgetViewProps> = ({ budgets, transactions, userProfile, onDelete, onAddBudget, onEdit, onClearAll }) => {
    const [proposals, setProposals] = useState<StrategyProposal[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const { showToast } = useFinancialContext() as any; // Quick fix for toast access if not in props

    const spendingMap = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const map: Record<string, number> = {};

        transactions.forEach(t => {
            const tDate = new Date(t.date);
            if (
                t.type === TransactionType.Expense &&
                !t.isTransfer &&
                tDate.getMonth() === currentMonth &&
                tDate.getFullYear() === currentYear
            ) {
                map[t.category] = (map[t.category] || 0) + t.amount;
            }
        });
        return map;
    }, [transactions]);

    const handleGenerateStrategies = async () => {
        setIsGenerating(true);
        try {
            const newProposals = await generateStrategies(transactions, userProfile);
            if (newProposals.length === 0) {
                // Fallback if AI fails or no data
                alert("Could not generate strategies. Try adding more transactions first.");
            } else {
                setProposals(newProposals);
            }
        } catch (error) {
            console.error("Strategy generation error", error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAcceptProposal = (proposal: StrategyProposal) => {
        const newBudget: Omit<Budget, 'id'> = {
            category: proposal.category,
            limit: proposal.proposedLimit,
            period: 'monthly',
            strategy: proposal.strategy,
            rationale: proposal.rationale,
            status: 'active'
        };
        onAddBudget(newBudget);
        setProposals(prev => prev.filter(p => p.category !== proposal.category));
    };

    const handleRejectProposal = (category: string) => {
        setProposals(prev => prev.filter(p => p.category !== category));
    };

    // Empty State (No Budgets AND No Proposals)
    if (budgets.length === 0 && proposals.length === 0) {
        return (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
                <div className="bg-brand-green-50 text-brand-green w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    {isGenerating ? <Loader2 className="animate-spin" size={32} /> : <Sparkles size={32} />}
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                    {isGenerating ? "Analyzing Spending Patterns..." : "AI Strategy Engine"}
                </h3>
                <p className="text-gray-500 max-w-xs mx-auto mt-2 mb-6">
                    {isGenerating
                        ? "Our models are crunching the numbers to find the best way to reach your goals."
                        : "Let the AI analyze your transaction history and suggest a personalized budget strategy."}
                </p>
                <Button onClick={handleGenerateStrategies} disabled={isGenerating}>
                    {isGenerating ? "Thinking..." : "Generate Strategies"}
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            {userProfile && (
                <div className="flex items-center justify-between bg-brand-green-50 border border-brand-green-100 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-white p-2 rounded-full text-brand-green shadow-sm">
                            <Target size={20} />
                        </div>
                        <div>
                            <h4 className="font-bold text-brand-gray-800">Primary Focus: {GOAL_LABELS[userProfile.primaryGoal]}</h4>
                            <p className="text-xs text-brand-gray-600">Strategies are optimized for this goal.</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleGenerateStrategies} disabled={isGenerating} className="text-xs bg-white border border-brand-green text-brand-green hover:bg-green-50 px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1">
                            {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            Refresh Ideas
                        </button>
                        <button onClick={onClearAll} className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors font-medium">
                            Clear All
                        </button>
                    </div>
                </div>
            )}

            {/* Proposals Section */}
            {proposals.length > 0 && (
                <div className="space-y-4">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Sparkles size={18} className="text-yellow-500" />
                        New Proposals
                        <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Review Required</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {proposals.map((proposal, idx) => (
                            <StrategyCard
                                key={`prop-${idx}`}
                                item={proposal}
                                type="proposal"
                                onAccept={() => handleAcceptProposal(proposal)}
                                onReject={() => handleRejectProposal(proposal.category)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Active Strategies Section */}
            {budgets.length > 0 && (
                <div className="space-y-4">
                    <h3 className="font-bold text-gray-800">Active Strategies</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {budgets.map(budget => (
                            <StrategyCard
                                key={budget.id}
                                item={budget}
                                type="active"
                                spent={spendingMap[budget.category] || 0}
                                onDelete={() => onDelete(budget.id)}
                            />
                        ))}

                        {/* Add Manual Button */}
                        <button
                            onClick={() => alert("Manual creation coming soon! Use AI for now.")}
                            className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:text-brand-green hover:border-brand-green hover:bg-green-50/30 transition-all min-h-[200px]"
                        >
                            <Plus size={32} className="mb-2" />
                            <span className="font-medium">Add Custom Limit</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BudgetView;
