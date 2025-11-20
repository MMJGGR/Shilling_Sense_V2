import React from 'react';
import { Budget, StrategyProposal, GOAL_LABELS } from '../types';
import { CheckCircle, XCircle, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Button from './ui/Button';

interface StrategyCardProps {
    item: Budget | StrategyProposal;
    type: 'active' | 'proposal';
    spent?: number; // Only for active
    onAccept?: () => void;
    onReject?: () => void;
    onDelete?: () => void;
}

const KESFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

const StrategyCard: React.FC<StrategyCardProps> = ({ item, type, spent = 0, onAccept, onReject, onDelete }) => {
    const isProposal = type === 'proposal';
    const limit = isProposal ? (item as StrategyProposal).proposedLimit : (item as Budget).limit;
    const category = item.category;
    const strategy = item.strategy;
    const rationale = item.rationale;
    const insight = (item as any).insight; // Insight might only be on Proposal, or we save it to Budget too? 
    // Note: We added rationale to Budget, but maybe not insight. Let's use rationale for now.

    const percentage = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;

    const getStrategyIcon = () => {
        switch (strategy) {
            case 'aggressive': return <TrendingDown size={16} className="text-red-500" />;
            case 'moderate': return <TrendingDown size={16} className="text-yellow-500" />;
            case 'maintain': return <Minus size={16} className="text-blue-500" />;
            case 'increase': return <TrendingUp size={16} className="text-green-500" />;
            default: return <Minus size={16} />;
        }
    };

    const getProgressColor = () => {
        if (percentage >= 100) return 'bg-red-500';
        if (percentage >= 75) return 'bg-yellow-500';
        return 'bg-brand-green';
    };

    return (
        <div className={`p-5 rounded-xl border transition-all ${isProposal ? 'bg-white border-brand-green-200 shadow-md' : 'bg-white border-gray-100 hover:shadow-lg'}`}>
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
                <div>
                    <div className="flex items-center gap-2">
                        <h4 className="font-bold text-gray-800 text-lg">{category}</h4>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1 bg-gray-100 text-gray-600`}>
                            {getStrategyIcon()}
                            {strategy}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 italic">"{rationale || insight}"</p>
                </div>
                <div className="text-right">
                    <p className="font-bold text-xl text-gray-900">{KESFormatter.format(limit)}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Monthly Limit</p>
                </div>
            </div>

            {/* Active State: Progress Bar */}
            {!isProposal && (
                <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                        <span className={`font-medium ${spent > limit ? 'text-red-600' : 'text-gray-600'}`}>
                            {KESFormatter.format(spent)} <span className="text-xs font-normal text-gray-400">spent</span>
                        </span>
                        <span className="text-gray-400">{Math.round(percentage)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                            className={`h-2 rounded-full transition-all duration-500 ${getProgressColor()}`}
                            style={{ width: `${percentage}%` }}
                        ></div>
                    </div>
                </div>
            )}

            {/* Proposal Actions */}
            {isProposal ? (
                <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
                    <button
                        onClick={onAccept}
                        className="flex-1 bg-brand-green text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-green-600 transition-colors flex items-center justify-center gap-2"
                    >
                        <CheckCircle size={16} /> Accept
                    </button>
                    <button
                        onClick={onReject}
                        className="flex-1 bg-gray-50 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                    >
                        <XCircle size={16} /> Reject
                    </button>
                </div>
            ) : (
                /* Active Actions (Delete) */
                <div className="flex justify-end mt-2">
                    <button
                        onClick={onDelete}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                        Remove Strategy
                    </button>
                </div>
            )}
        </div>
    );
};

export default StrategyCard;
