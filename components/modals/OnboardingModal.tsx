

import React, { useState } from 'react';
import { UserProfile, FinancialGoal, GOAL_LABELS } from '../../types';
import BaseModal from './BaseModal';
import Button from '../ui/Button';
import { Target, User, Calendar, Banknote } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onSave: (profile: UserProfile) => void;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onSave }) => {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [goal, setGoal] = useState<FinancialGoal>('control_spend');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');

  const handleSave = () => {
    if (name && age) {
      onSave({
        name,
        age: parseInt(age),
        primaryGoal: goal,
        targetAmount: targetAmount ? parseFloat(targetAmount) : undefined,
        targetDate: targetDate || undefined,
        joinedDate: new Date().toISOString()
      });
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={() => {}} title="Welcome to Shilling Sense" backdropClosable={false}>
      <div className="space-y-5">
        <div className="text-center">
            <div className="bg-brand-green-50 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3">
                <Target className="text-brand-green h-7 w-7" />
            </div>
            <p className="text-brand-gray-600 text-sm">
                Let's set a SMART goal to guide your budgeting strategy.
            </p>
        </div>

        <div className="space-y-4">
            <div>
                <label className="block text-xs font-bold text-brand-gray-700 uppercase tracking-wide mb-1">What should we call you?</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User size={16} className="text-gray-400" />
                    </div>
                    <input 
                        type="text" 
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        className="pl-10 block w-full rounded-md border-brand-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green text-sm py-2" 
                        placeholder="e.g. John"
                    />
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                    <label className="block text-xs font-bold text-brand-gray-700 uppercase tracking-wide mb-1">Age</label>
                    <input 
                        type="number" 
                        value={age} 
                        onChange={(e) => setAge(e.target.value)} 
                        className="block w-full rounded-md border-brand-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green text-sm py-2" 
                        placeholder="25"
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-brand-gray-700 uppercase tracking-wide mb-1">Primary Financial Goal</label>
                <select 
                    value={goal} 
                    onChange={(e) => setGoal(e.target.value as FinancialGoal)} 
                    className="block w-full rounded-md border-brand-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green text-sm py-2"
                >
                    {Object.entries(GOAL_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </select>
            </div>
            
            {/* SMART GOAL INPUTS */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                <h4 className="text-xs font-bold text-gray-500 uppercase">Make it SMART</h4>
                <div>
                    <label className="block text-xs font-medium text-brand-gray-600 mb-1">Target Amount (KES)</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Banknote size={14} className="text-gray-400" />
                        </div>
                        <input 
                            type="number" 
                            value={targetAmount} 
                            onChange={(e) => setTargetAmount(e.target.value)} 
                            className="pl-9 block w-full rounded-md border-brand-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green text-sm" 
                            placeholder="e.g. 50000"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-medium text-brand-gray-600 mb-1">Target Date</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Calendar size={14} className="text-gray-400" />
                        </div>
                        <input 
                            type="date" 
                            value={targetDate} 
                            onChange={(e) => setTargetDate(e.target.value)} 
                            className="pl-9 block w-full rounded-md border-brand-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green text-sm" 
                        />
                    </div>
                </div>
            </div>
        </div>

        <div className="pt-4 border-t border-gray-100">
            <Button onClick={handleSave} disabled={!name || !age} className="w-full">
                Start My Journey
            </Button>
        </div>
      </div>
    </BaseModal>
  );
};

export default OnboardingModal;