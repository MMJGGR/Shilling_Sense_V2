
import React, { useMemo } from 'react';
import { Budget, Transaction, TransactionType, UserProfile, GOAL_LABELS } from '../types';
import Card from './ui/Card';
import Button from './ui/Button';
import { Plus, Trash2, AlertTriangle, ThumbsUp, CheckCircle, Target } from 'lucide-react';

interface BudgetViewProps {
    budgets: Budget[];
    transactions: Transaction[];
    userProfile: UserProfile | null;
    onDelete: (id: string) => void;
    onAddBudget: () => void;
    onEdit: () => void;
    onClearAll: () => void;
}

const KESFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

const BudgetView: React.FC<BudgetViewProps> = ({ budgets, transactions, userProfile, onDelete, onAddBudget, onEdit, onClearAll }) => {

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

    const getProgressColor = (percentage: number) => {
        if (percentage >= 100) return 'bg-red-500';
        if (percentage >= 75) return 'bg-yellow-500';
        return 'bg-brand-green';
    };

    const getNudge = (spent: number, limit: number, category: string) => {
        const percentage = (spent / limit) * 100;
        const remaining = limit - spent;
        const name = userProfile ? userProfile.name.split(' ')[0] : 'friend';
        const goalText = userProfile ? GOAL_LABELS[userProfile.primaryGoal] : 'your goals';

        if (percentage >= 100) {
            return {
                text: `Limit exceeded. ${name}, try to cut back next month to stay on track for ${goalText}.`,
                icon: <AlertTriangle size={14} />,
                color: 'text-red-600 bg-red-50 border-red-100'
            };
        }
        if (percentage >= 75) {
            return {
                text: `Heads up ${name}, you're nearing the limit. Only ${KESFormatter.format(remaining)} left.`,
                icon: <AlertTriangle size={14} />,
                color: 'text-yellow-700 bg-yellow-50 border-yellow-100'
            };
        }
        if (spent === 0) {
            return {
                text: "No spending yet. A perfect start to the month!",
                icon: <CheckCircle size={14} />,
                color: 'text-gray-600 bg-gray-50 border-gray-100'
            };
        }

        // Positive reinforcement referencing the goal
        return {
            text: `Great discipline! Saving here helps you ${goalText.toLowerCase()}.`,
            icon: <ThumbsUp size={14} />,
            color: 'text-green-700 bg-green-50 border-green-100'
        };
    };

    if (budgets.length === 0) {
        return (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
                <div className="bg-green-50 text-brand-green w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Target size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">No Strategies Set</h3>
                <p className="text-gray-500 max-w-xs mx-auto mt-2 mb-6">
                    {userProfile
                        ? `${userProfile.name}, let's set some spending strategies to help you ${GOAL_LABELS[userProfile.primaryGoal]}.`
                        : "Take control of your finances by setting strategic limits."}
                </p>
                <Button onClick={onAddBudget}>
                    <Plus size={16} className="mr-2" /> Create Strategy
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {userProfile && (
                <div className="flex items-center justify-between bg-brand-green-50 border border-brand-green-100 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-white p-2 rounded-full text-brand-green shadow-sm">
                            <Target size={20} />
                        </div>
                        <div>
                            <h4 className="font-bold text-brand-gray-800">Primary Focus: {GOAL_LABELS[userProfile.primaryGoal]}</h4>
                            <p className="text-xs text-brand-gray-600">Your budgets below are designed to help you reach this.</p>
                        </div>
                    </div>
                    <button onClick={onClearAll} className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors font-medium">
                        Clear All
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {budgets.map(budget => {
                    const spent = spendingMap[budget.category] || 0;
                    const percentage = Math.min((spent / budget.limit) * 100, 100);
                    const nudge = getNudge(spent, budget.limit, budget.category);

                    return (
                        <Card key={budget.id} className="p-5 flex flex-col transition-all hover:shadow-lg border border-gray-100 group">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h4 className="font-bold text-gray-800 text-lg">{budget.category}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${budget.strategy === 'aggressive' ? 'bg-red-100 text-red-600' :
                                                budget.strategy === 'moderate' ? 'bg-yellow-100 text-yellow-600' :
                                                    'bg-blue-100 text-blue-600'
                                            }`}>
                                            {budget.strategy === 'custom' ? 'Custom' : budget.strategy}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-gray-900">{KESFormatter.format(budget.limit)}</p>
                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => onDelete(budget.id)}
                                            className="text-gray-300 hover:text-red-500 mt-1 p-1"
                                            title="Delete Budget"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="mb-4">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className={`font-medium ${spent > budget.limit ? 'text-red-600' : 'text-gray-600'}`}>
                                        {KESFormatter.format(spent)}
                                    </span>
                                    <span className="text-gray-400">{Math.round(percentage)}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className={`h-2.5 rounded-full transition-all duration-500 ${getProgressColor((spent / budget.limit) * 100)}`}
                                        style={{ width: `${percentage}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Nudge */}
                            <div className={`mt-auto p-3 rounded-lg border flex gap-3 items-start text-xs ${nudge.color}`}>
                                <div className="mt-0.5 flex-shrink-0">{nudge.icon}</div>
                                <p className="leading-relaxed font-medium">{nudge.text}</p>
                            </div>
                        </Card>
                    );
                })}

                {/* Add Button Card */}
                <button
                    onClick={onAddBudget}
                    className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:text-brand-green hover:border-brand-green hover:bg-green-50/30 transition-all min-h-[200px]"
                >
                    <Plus size={32} className="mb-2" />
                    <span className="font-medium">Strategize New Category</span>
                </button>
            </div>
        </div>
    );
};

export default BudgetView;
