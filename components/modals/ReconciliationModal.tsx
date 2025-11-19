import React, { useState, useEffect } from 'react';
import { Transaction } from '../../types';
import { suggestTransferPairs } from '../../services/geminiService';
import BaseModal from './BaseModal';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import { ArrowRight } from 'lucide-react';

interface ReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  onReconcile: (pairs: string[][]) => void;
}

const KESFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'KES',
});

const ReconciliationModal: React.FC<ReconciliationModalProps> = ({ isOpen, onClose, transactions, onReconcile }) => {
  const [suggestedPairs, setSuggestedPairs] = useState<Transaction[][]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPairs, setSelectedPairs] = useState<boolean[]>([]);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      suggestTransferPairs(transactions).then(pairs => {
        setSuggestedPairs(pairs);
        setSelectedPairs(new Array(pairs.length).fill(true)); // Pre-select all suggestions
        setIsLoading(false);
      });
    }
  }, [isOpen, transactions]);

  const handleTogglePair = (index: number) => {
    const newSelected = [...selectedPairs];
    newSelected[index] = !newSelected[index];
    setSelectedPairs(newSelected);
  };

  const handleConfirm = () => {
    const confirmedPairIds = suggestedPairs
      .filter((_, index) => selectedPairs[index])
      .map(pair => pair.map(tx => tx.id));
    
    if (confirmedPairIds.length > 0) {
        onReconcile(confirmedPairIds);
    }
    onClose();
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-48">
          <Spinner />
          <p className="mt-4 text-brand-gray-600">AI is looking for internal transfers...</p>
        </div>
      );
    }
    if (suggestedPairs.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-brand-gray-600">No potential transfers found to reconcile.</p>
        </div>
      );
    }
    return (
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        <p className="text-sm text-brand-gray-600">
          The AI found these transactions that look like internal transfers. Please review and confirm. Uncheck any pairs that are incorrect.
        </p>
        {suggestedPairs.map((pair, index) => {
          const [tx1, tx2] = pair;
          // Ensure there's one income and one expense for consistent display
          const expenseTx = tx1.type === 'expense' ? tx1 : tx2;
          const incomeTx = tx1.type === 'income' ? tx1 : tx2;

          if (!expenseTx || !incomeTx) return null; // Skip malformed pairs

          return (
            <div key={index} className="p-3 rounded-lg border flex items-center gap-3 bg-brand-gray-50">
              <input
                type="checkbox"
                checked={selectedPairs[index]}
                onChange={() => handleTogglePair(index)}
                className="h-5 w-5 rounded border-gray-300 text-brand-green focus:ring-brand-green"
              />
              <div className="flex-1 text-sm">
                <p className="font-medium text-red-600">
                  <span className="font-normal text-brand-gray-500">From:</span> {expenseTx.description}
                </p>
                <p className="font-medium text-green-600">
                  <span className="font-normal text-brand-gray-500">To:</span> {incomeTx.description}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{KESFormatter.format(expenseTx.amount)}</p>
                <p className="text-xs text-brand-gray-500">{new Date(expenseTx.date).toLocaleDateString()}</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Reconcile Internal Transfers">
      {renderContent()}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleConfirm} disabled={isLoading || suggestedPairs.length === 0}>
          Confirm ({selectedPairs.filter(Boolean).length})
        </Button>
      </div>
    </BaseModal>
  );
};

export default ReconciliationModal;
