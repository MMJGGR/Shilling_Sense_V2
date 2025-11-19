
import React, { useState, useEffect, useMemo } from 'react';
import { Budget, BudgetStrategy, Category, Transaction, TransactionType, UserProfile, GOAL_LABELS } from '../../types';
import BaseModal from './BaseModal';
import Button from '../ui/Button';
import { Target, Leaf, Shield, TrendingUp, AlertTriangle, CheckCircle2, Wallet, Sliders, Info, TrendingDown, Activity, CalendarClock, Banknote } from 'lucide-react';
import { DISCRETIONARY_CATEGORIES, SAVINGS_CATEGORIES } from '../../constants';

interface BudgetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (budgets: Omit<Budget, 'id'>[]) => void;
    categories: Category[];
    transactions: Transaction[];
    userProfile: UserProfile | null;
    existingBudgets: Budget[];
}

const KESFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

interface DraftBudget {
    category: string;
    average: number;
    max: number;
    min: number;
    history: number[]; // 12-month history
    frequency: string; // 'Monthly', 'Occasional', 'Rare'
    volatility: number; // 0-1 score (Standard Deviation / Mean)
    limit: number;
    strategy: BudgetStrategy;
    isDiscretionary: boolean;
    isSavings: boolean;
    isModified: boolean;
}

const BudgetModal: React.FC<BudgetModalProps> = ({ isOpen, onClose, onSave, transactions, userProfile, existingBudgets }) => {
    const [drafts, setDrafts] = useState<DraftBudget[]>([]);
    const [granularity, setGranularity] = useState(0); // 0 = Detailed, 100 = Grouped
    const [avgMonthlyIncome, setAvgMonthlyIncome] = useState(0);

    useEffect(() => {
        if (!isOpen) return;

        // 1. ANALYZE INCOME CONTEXT (12 Months)
        const incomeByMonth: Record<string, number> = {};
        const expenseByMonthCategory: Record<string, Record<string, number>> = {};
        const allMonthsSet = new Set<string>();

        transactions.forEach(t => {
            const d = new Date(t.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            allMonthsSet.add(key);

            if (t.type === TransactionType.Income && !t.isTransfer) {
                incomeByMonth[key] = (incomeByMonth[key] || 0) + t.amount;
            } else if (t.type === TransactionType.Expense && !t.isTransfer) {
                if (!expenseByMonthCategory[t.category]) expenseByMonthCategory[t.category] = {};
                expenseByMonthCategory[t.category][key] = (expenseByMonthCategory[t.category][key] || 0) + t.amount;
            }
        });

        // Calculate Income Avg (ignoring months with 0 if we have better data, unless only 0)
        const incomeValues = Object.values(incomeByMonth);
        const nonZeroIncomes = incomeValues.filter(v => v > 0);
        const calculatedIncomeAvg = nonZeroIncomes.length > 0
            ? nonZeroIncomes.reduce((a, b) => a + b, 0) / nonZeroIncomes.length
            : 0;
        setAvgMonthlyIncome(calculatedIncomeAvg);

        // 2. ANALYZE EXPENSES (Up to 12 Months Context)
        const sortedMonths = Array.from(allMonthsSet).sort().reverse().slice(0, 12); // Last 12 active months

        const initialDrafts: DraftBudget[] = Object.keys(expenseByMonthCategory).map(cat => {
            const monthlyValues = sortedMonths.map(m => expenseByMonthCategory[cat][m] || 0);
            const activeMonths = monthlyValues.filter(v => v > 0).length;

            // Basic Stats
            const total = monthlyValues.reduce((a, b) => a + b, 0);
            const average = total / (sortedMonths.length || 1);
            const max = Math.max(...monthlyValues);
            const min = Math.min(...monthlyValues.filter(v => v > 0)); // Lowest NON-ZERO spend

            // Volatility (Coefficient of Variation)
            const mean = total / monthlyValues.length;
            const variance = monthlyValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / monthlyValues.length;
            const stdDev = Math.sqrt(variance);
            const volatility = mean > 0 ? stdDev / mean : 0;

            // Frequency Label
            let frequency = 'Monthly';
            const presenceRatio = activeMonths / (sortedMonths.length || 1);
            if (presenceRatio < 0.4) frequency = 'Rare';
            else if (presenceRatio < 0.8) frequency = 'Occasional';

            const existing = existingBudgets.find(b => b.category === cat);
            const isDiscretionary = DISCRETIONARY_CATEGORIES.includes(cat);
            const isSavings = SAVINGS_CATEGORIES.includes(cat);

            // --- GOAL-DRIVEN LOGIC ---
            let suggestedLimit = Math.round(average);
            let strategy: BudgetStrategy = existing ? existing.strategy : 'maintain';

            if (!existing && userProfile) {
                const goal = userProfile.primaryGoal;

                if (isSavings) {
                    // PROTECT SAVINGS: Never suggest cutting. Suggest increasing for savings goals.
                    if (['save_emergency', 'invest', 'buy_asset', 'travel'].includes(goal)) {
                        suggestedLimit = Math.round(average * 1.1); // Suggest 10% increase
                        strategy = 'increase';
                    } else {
                        strategy = 'maintain';
                    }
                } else if (isDiscretionary) {
                    // CUT DISCRETIONARY: Aggressively cut for savings/debt goals.
                    if (['save_emergency', 'pay_debt', 'control_spend'].includes(goal)) {
                        suggestedLimit = Math.round(average * 0.8); // Suggest 20% cut
                        strategy = 'aggressive';
                    } else if (['invest', 'buy_asset'].includes(goal)) {
                        suggestedLimit = Math.round(average * 0.9); // Suggest 10% cut
                        strategy = 'moderate';
                    }
                }
                // Essentials are left at 'maintain' / average usually, unless we add specific logic for them.
            }

            return {
                category: cat,
                average: Math.round(average),
                max,
                min: min === Infinity ? 0 : min,
                history: monthlyValues, // 0 is most recent
                frequency,
                volatility,
                limit: existing ? existing.limit : suggestedLimit,
                strategy: strategy,
                isDiscretionary,
                isSavings,
                isModified: false
            };
        }).sort((a, b) => b.average - a.average);

        setDrafts(initialDrafts);
    }, [isOpen, transactions, existingBudgets, userProfile]);

    // --- GRANULARITY & GROUPING LOGIC ---
    const displayDrafts = useMemo(() => {
        if (granularity === 0) return drafts;

        const totalSpend = drafts.reduce((sum, d) => sum + d.average, 0);
        const thresholdPercent = (granularity / 100) * 0.05; // 0% to 5%
        const thresholdAmount = totalSpend * thresholdPercent;

        const major: DraftBudget[] = [];
        const minor: DraftBudget[] = [];

        drafts.forEach(d => {
            // Keep Savings, High Impact, or Non-Monthly (Rare) items separate usually? 
            // Actually, group rare small items.
            if (d.average > thresholdAmount || d.isSavings) {
                major.push(d);
            } else {
                minor.push(d);
            }
        });

        if (minor.length > 0) {
            const groupedMinor: DraftBudget = {
                category: "Other Minor Expenses",
                average: minor.reduce((s, d) => s + d.average, 0),
                max: minor.reduce((s, d) => s + d.max, 0),
                min: minor.reduce((s, d) => s + d.min, 0),
                history: [], // Too complex to merge arrays perfectly aligned without map, skip for grouped
                frequency: 'Various',
                volatility: 0,
                limit: minor.reduce((s, d) => s + d.limit, 0),
                strategy: 'maintain',
                isDiscretionary: true,
                isSavings: false,
                isModified: false
            };
            return [...major, groupedMinor];
        }

        return major;
    }, [drafts, granularity]);

    const updateDraft = (category: string, updates: Partial<DraftBudget>) => {
        setDrafts(prev => prev.map(d => d.category === category ? { ...d, ...updates, isModified: true } : d));
    };

    const handleCustomLimitChange = (category: string, value: string) => {
        const val = parseInt(value) || 0;
        updateDraft(category, { strategy: 'custom', limit: val });
    };

    // --- IMPACT & FEASIBILITY ANALYSIS ---
    const impactAnalysis = useMemo(() => {
        const currentTotalSpent = drafts.reduce((acc, d) => acc + (d.isSavings ? 0 : d.average), 0);
        const newTotalBudget = drafts.reduce((acc, d) => acc + (d.isSavings ? 0 : d.limit), 0);

        // "Potential Savings" = Income - Planned Expenses
        // This is the true bottom line the user cares about
        const plannedNetSavings = avgMonthlyIncome > 0 ? (avgMonthlyIncome - newTotalBudget) : (currentTotalSpent - newTotalBudget);
        const freedUpCash = currentTotalSpent - newTotalBudget;

        // Feasibility: Risk of breach based on volatility
        let riskyCuts = 0;
        drafts.forEach(d => {
            if (!d.isSavings && d.limit < d.min && d.volatility < 0.2) {
                // Cutting below minimum on a stable bill (e.g. Rent) is VERY risky
                riskyCuts++;
            } else if (!d.isSavings && d.limit < d.average * 0.8 && d.frequency === 'Monthly') {
                // Deep cuts on recurring items
                riskyCuts++;
            }
        });

        return { plannedNetSavings, newTotalBudget, riskyCuts, freedUpCash };
    }, [drafts, avgMonthlyIncome]);

    // Projection
    const goalProjection = useMemo(() => {
        if (!userProfile?.targetAmount || impactAnalysis.plannedNetSavings <= 0) return null;
        const monthsToGoal = Math.ceil(userProfile.targetAmount / impactAnalysis.plannedNetSavings);
        const projectedDate = new Date();
        projectedDate.setMonth(projectedDate.getMonth() + monthsToGoal);
        return { months: monthsToGoal, date: projectedDate };
    }, [userProfile, impactAnalysis.plannedNetSavings]);

    const handleSaveAll = () => {
        const budgetsToSave = drafts
            .filter(d => d.isModified || d.strategy !== 'maintain' || d.isSavings)
            .map(d => ({
                category: d.category,
                limit: d.limit,
                period: 'monthly' as const,
                strategy: d.strategy
            }));
        onSave(budgetsToSave);
        onClose();
    };

    const renderSmartChips = (draft: DraftBudget) => {
        if (draft.category === "Other Minor Expenses") return null;

        if (draft.isSavings) {
            return (
                <div className="flex gap-2">
                    <button onClick={() => updateDraft(draft.category, { limit: draft.average, strategy: 'maintain' })} className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${draft.strategy === 'maintain' ? 'bg-gray-800 text-white' : 'bg-white hover:bg-gray-50'}`}>Maintain</button>
                    <button onClick={() => updateDraft(draft.category, { limit: Math.round(draft.average * 1.1), strategy: 'increase' })} className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${draft.strategy === 'increase' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-white hover:bg-purple-50'}`}>Boost 10%</button>
                </div>
            );
        }

        const isVolatile = draft.volatility > 0.4;
        const isStable = draft.volatility < 0.1;
        const isRare = draft.frequency === 'Rare';

        return (
            <div className="flex flex-wrap gap-2 justify-end">
                {/* Option 1: The Baseline */}
                <button
                    onClick={() => updateDraft(draft.category, { limit: draft.average, strategy: 'maintain' })}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${draft.strategy === 'maintain' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                    Avg
                </button>

                {/* Option 2: Intelligent Recommendation */}
                {isVolatile ? (
                    <button
                        onClick={() => updateDraft(draft.category, { limit: Math.round(draft.average), strategy: 'custom' })}
                        title="Spending fluctuates wildly. Cap at average to smooth it out."
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 ${draft.strategy === 'custom' && draft.limit === Math.round(draft.average) ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-gray-600 hover:bg-blue-50'}`}
                    >
                        <Activity size={12} /> Stabilize
                    </button>
                ) : isStable && !isRare ? (
                    <button
                        onClick={() => updateDraft(draft.category, { limit: Math.round(draft.average * 0.9), strategy: 'aggressive' })}
                        title="Stable bill. Try negotiating or switching providers."
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 ${draft.strategy === 'aggressive' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-white text-gray-600 hover:bg-orange-50'}`}
                    >
                        <Target size={12} /> Challenge
                    </button>
                ) : (
                    <button
                        onClick={() => updateDraft(draft.category, { limit: Math.round(draft.min * 1.05), strategy: 'moderate' })}
                        title={`Target your best month: ${KESFormatter.format(draft.min)}`}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 ${draft.strategy === 'moderate' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-gray-600 hover:bg-green-50'}`}
                    >
                        <TrendingDown size={12} /> Target Lows
                    </button>
                )}

                {/* Option 3: Hard Cut (if discretionary) */}
                {draft.isDiscretionary && (
                    <button
                        onClick={() => updateDraft(draft.category, { limit: Math.round(draft.average * 0.8), strategy: 'aggressive' })}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${draft.strategy === 'aggressive' && !isStable ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white text-gray-600 hover:bg-red-50'}`}
                    >
                        Cut 20%
                    </button>
                )}
            </div>
        );
    };

    const renderCategoryRow = (draft: DraftBudget) => {
        return (
            <div key={draft.category} className={`p-4 rounded-xl border transition-all hover:shadow-lg ${draft.isDiscretionary ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="grid grid-cols-12 gap-4 items-center">

                    {/* COL 1: Category Info (Span 4) */}
                    <div className="col-span-12 lg:col-span-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${draft.isSavings ? 'bg-purple-100 text-purple-700' : draft.isDiscretionary ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                {draft.isSavings ? <Wallet size={20} /> : draft.isDiscretionary ? <Leaf size={20} /> : <Shield size={20} />}
                            </div>
                            <div>
                                <div className="font-bold text-gray-900 text-lg truncate">{draft.category}</div>
                                {draft.frequency !== 'Monthly' && draft.frequency !== 'Various' && (
                                    <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit mt-1">
                                        <CalendarClock size={10} /> {draft.frequency}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* COL 2: Stats (Span 3) */}
                    <div className="col-span-12 sm:col-span-6 lg:col-span-3 flex flex-col justify-center">
                        <div className="grid grid-cols-3 gap-2 text-center text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
                            <div>
                                <span className="block text-[10px] uppercase tracking-wider opacity-70">Best</span>
                                <span className="font-semibold text-gray-700">{KESFormatter.format(draft.min)}</span>
                            </div>
                            <div className="border-x border-gray-200">
                                <span className="block text-[10px] uppercase tracking-wider opacity-70">Avg</span>
                                <span className="font-bold text-gray-900">{KESFormatter.format(draft.average)}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] uppercase tracking-wider opacity-70">Max</span>
                                <span className="font-semibold text-gray-700">{KESFormatter.format(draft.max)}</span>
                            </div>
                        </div>
                    </div>

                    {/* COL 3: Range & Plan (Span 3) */}
                    <div className="col-span-12 sm:col-span-6 lg:col-span-3">
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden relative mt-1">
                            {/* The "Average" Marker */}
                            <div className="absolute top-0 bottom-0 w-1 bg-gray-300 z-10" style={{ left: `${((draft.average - draft.min) / (draft.max - draft.min || 1)) * 100}%` }} title={`Average: ${KESFormatter.format(draft.average)}`}></div>
                            {/* The Proposed Limit Marker */}
                            <div className={`absolute top-0 bottom-0 w-3 h-3 rounded-full z-20 transition-all shadow-sm border border-white ${draft.limit < draft.average ? 'bg-green-500' : 'bg-blue-500'}`}
                                style={{ left: `${Math.min(100, Math.max(0, ((draft.limit - draft.min) / (draft.max - draft.min || 1)) * 100))}%` }}>
                            </div>
                        </div>
                        <div className="mt-2 flex justify-between items-start">
                            <span className="text-xs text-gray-400 mt-0.5">Plan:</span>
                            <div className="text-right">
                                <div className={`text-sm font-bold ${draft.limit < draft.average ? "text-green-600" : "text-gray-900"}`}>
                                    {KESFormatter.format(draft.limit)}
                                </div>
                                {draft.limit !== draft.average && (
                                    <div className={`text-[10px] font-medium flex items-center justify-end gap-1 ${draft.limit < draft.average ? 'text-green-600' : 'text-blue-600'}`}>
                                        {draft.limit < draft.average ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                                        {Math.round(Math.abs((draft.limit - draft.average) / draft.average) * 100)}% vs Avg
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* COL 4: Controls (Span 2) */}
                    <div className="col-span-12 lg:col-span-2 flex flex-col gap-2 justify-center">
                        <div className="flex justify-end">
                            {renderSmartChips(draft)}
                        </div>

                        <div className="flex items-center gap-2 justify-end">
                            <div className="relative w-full">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">KES</span>
                                <input
                                    type="number"
                                    value={draft.limit}
                                    onChange={(e) => handleCustomLimitChange(draft.category, e.target.value)}
                                    className={`w-full pl-10 pr-3 py-2 text-right text-sm font-bold border rounded-lg focus:ring-2 transition-all outline-none ${draft.limit < draft.average && !draft.isSavings ? 'border-green-300 text-green-700 bg-green-50 focus:border-green-500 focus:ring-green-200' : 'border-gray-300 focus:border-brand-green focus:ring-brand-green/20'}`}
                                    placeholder="Custom"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const savingsDrafts = displayDrafts.filter(d => d.isSavings);
    const discretionaryDrafts = displayDrafts.filter(d => d.isDiscretionary && !d.isSavings);
    const essentialDrafts = displayDrafts.filter(d => !d.isDiscretionary && !d.isSavings);

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title="Strategy Planner" backdropClosable={false} maxWidth="max-w-6xl">
            {/* STICKY FINANCIAL CONTEXT HEADER */}
            <div className="bg-gradient-to-b from-brand-green-50 to-white -mx-6 -mt-4 p-6 border-b border-brand-green-100 sticky top-0 z-20 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* 1. INCOME CONTEXT */}
                    <div className="p-4 bg-white rounded-xl border border-brand-green-100 shadow-sm flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-gray-500 mb-1">
                                <Banknote size={16} />
                                <span className="text-xs font-bold uppercase tracking-wider">Avg Monthly Income</span>
                            </div>
                            <p className="text-2xl font-black text-gray-800">
                                {avgMonthlyIncome > 0 ? KESFormatter.format(avgMonthlyIncome) : <span className="text-sm text-gray-400 italic">No income data</span>}
                            </p>
                        </div>
                    </div>

                    {/* 2. GOAL CONTEXT */}
                    <div className="p-4 bg-brand-green text-white rounded-xl shadow-md flex flex-col justify-center">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 opacity-90">
                                <Target size={16} />
                                <span className="text-xs font-bold uppercase tracking-wider">{userProfile ? GOAL_LABELS[userProfile.primaryGoal] : "Net Savings"}</span>
                            </div>
                            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full text-white">Target / mo</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-black tracking-tight">
                                {KESFormatter.format(impactAnalysis.plannedNetSavings)}
                            </p>
                        </div>
                        {goalProjection && (
                            <p className="text-xs opacity-80 mt-1 flex items-center gap-1">
                                <CalendarClock size={12} /> Goal met by {goalProjection.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            </p>
                        )}
                    </div>

                    {/* 3. RISK & GRANULARITY */}
                    <div className="flex flex-col justify-center gap-3">
                        <div className="flex items-center justify-between bg-gray-50 p-2 rounded-lg border border-gray-100">
                            <div className="flex items-center gap-2">
                                <Sliders size={16} className="text-gray-400" />
                                <span className="text-xs font-bold text-gray-500 uppercase">View Mode</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400 font-medium">{granularity === 0 ? 'Detailed' : 'Focused'}</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="25"
                                    value={granularity}
                                    onChange={(e) => setGranularity(parseInt(e.target.value))}
                                    className="h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-green w-24"
                                />
                            </div>
                        </div>

                        {impactAnalysis.riskyCuts > 0 ? (
                            <div className="flex items-center justify-center gap-2 text-orange-700 bg-orange-50 px-3 py-2 rounded-lg text-sm font-bold border border-orange-100">
                                <AlertTriangle size={16} /> {impactAnalysis.riskyCuts} Risky Cuts Detected
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2 text-brand-green bg-green-50 px-3 py-2 rounded-lg text-sm font-bold border border-green-100">
                                <CheckCircle2 size={16} /> Plan Feasible
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="max-h-[65vh] overflow-y-auto -mx-2 px-2 space-y-8 custom-scrollbar pt-6 pb-6">
                {/* SECTION 0: SAVINGS & GOALS */}
                {savingsDrafts.length > 0 && (
                    <div>
                        <div className="flex items-center gap-3 mb-4 px-2 border-b border-gray-100 pb-2">
                            <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                                <Wallet size={20} />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-lg">Savings & Investments</h4>
                                <p className="text-xs text-gray-500">Pay yourself first. Build wealth and security.</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {savingsDrafts.map(renderCategoryRow)}
                        </div>
                    </div>
                )}

                {/* SECTION 1: DISCRETIONARY */}
                {discretionaryDrafts.length > 0 && (
                    <div>
                        <div className="flex items-center gap-3 mb-4 px-2 mt-8 border-b border-gray-100 pb-2">
                            <div className="p-2 bg-green-100 text-green-700 rounded-lg">
                                <Leaf size={20} />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-lg">Discretionary (Flexible)</h4>
                                <p className="text-xs text-gray-500">Lifestyle choices. Easiest to adjust for quick savings.</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {discretionaryDrafts.map(renderCategoryRow)}
                        </div>
                    </div>
                )}

                {/* SECTION 2: ESSENTIALS */}
                {essentialDrafts.length > 0 && (
                    <div>
                        <div className="flex items-center gap-3 mb-4 mt-8 px-2 border-b border-gray-100 pb-2">
                            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                                <Shield size={20} />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-lg">Essentials (Fixed)</h4>
                                <p className="text-xs text-gray-500">Needs, not wants. Harder to reduce quickly.</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {essentialDrafts.map(renderCategoryRow)}
                        </div>
                    </div>
                )}

                {drafts.length === 0 && (
                    <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                        <p className="text-gray-500 font-medium">No transaction history found to analyze.</p>
                        <p className="text-sm text-gray-400 mt-2">Add transactions to generate a smart budget strategy.</p>
                    </div>
                )}
            </div>

            {/* FOOTER */}
            <div className="mt-0 pt-6 border-t border-gray-100 flex justify-between items-center gap-4 bg-white sticky bottom-0 z-10">
                <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full">
                    <Info size={12} />
                    <span>Based on 12-month spending history</span>
                </div>
                <div className="flex gap-3 ml-auto">
                    <Button variant="secondary" onClick={onClose} className="px-6">Discard</Button>
                    <Button onClick={handleSaveAll} className="shadow-lg shadow-brand-green/20 px-8">
                        Apply Strategy
                    </Button>
                </div>
            </div>
        </BaseModal>
    );
};

export default BudgetModal;
