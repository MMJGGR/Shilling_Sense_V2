
import React, { useState } from 'react';
import { Account, CategorizationExample, Category, ParsedTransaction, Transaction, TransactionType } from '../../types';
import BaseModal from './BaseModal';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import { parseBasicInfoFromText, enrichTransaction } from '../../services/geminiService';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (transaction: Omit<Transaction, 'id'>) => void;
  accounts: Account[];
  categorizationExamples: CategorizationExample[];
}

const AddTransactionModal: React.FC<AddTransactionModalProps> = ({ isOpen, onClose, onAdd, accounts, categorizationExamples }) => {
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isManualMode, setIsManualMode] = useState(false);
  const [touched, setTouched] = useState(false);
  
  // Manual form state
  const [manualAmount, setManualAmount] = useState('');
  const [manualMerchant, setManualMerchant] = useState('');
  const [manualType, setManualType] = useState<TransactionType>(TransactionType.Expense);

  const handleAdd = async () => {
    setTouched(true);
    if (!description || !accountId) return;
    
    setIsLoading(true);
    setError(null);

    try {
        // Step 1: Parse just the basic info (amount, raw description, type)
        const basicInfo = await parseBasicInfoFromText(description);

        // Step 2: Create a base transaction object to be enriched
        const transactionToEnrich: ParsedTransaction = {
            ...basicInfo,
            date: new Date().toISOString().split('T')[0], // Use today's date
        };

        // Step 3: Enrich the transaction using the 4-layer system (heuristics, map, cache, AI)
        const enrichedData = await enrichTransaction(transactionToEnrich, categorizationExamples);
        
        let logoUrl: string | undefined;
        try {
            if (enrichedData.enrichedInfo?.website && (enrichedData.enrichedInfo.website.startsWith('http://') || enrichedData.enrichedInfo.website.startsWith('https://'))) {
                logoUrl = new URL(enrichedData.enrichedInfo.website).hostname;
            }
        } catch (e) {
            console.warn(`Invalid URL provided for transaction: ${enrichedData.enrichedInfo?.website}`);
            logoUrl = undefined;
        }

        const newTransaction: Omit<Transaction, 'id'> = {
            accountId,
            date: enrichedData.date,
            merchant: enrichedData.enrichedInfo?.officialName || enrichedData.merchant || 'Unknown',
            amount: enrichedData.amount,
            type: enrichedData.type,
            category: enrichedData.category || 'Other',
            description: enrichedData.description, // The original, full description
            logoUrl: logoUrl,
            isTransfer: enrichedData.category === "Internal Transfer"
        };

        onAdd(newTransaction);
        resetForm();
        onClose();
    } catch (e) {
        if (e instanceof Error) {
            setError(e.message);
            setIsManualMode(true); // Switch to manual mode on AI failure
        } else {
            setError("An unknown error occurred. Please enter details manually.");
            setIsManualMode(true);
        }
    } finally {
        setIsLoading(false);
    }
  };

  const handleManualAdd = () => {
    setTouched(true);
    if (!manualAmount || !manualMerchant || !accountId) return;

    const newTransaction: Omit<Transaction, 'id'> = {
      accountId,
      date: new Date().toISOString().split('T')[0],
      merchant: manualMerchant,
      amount: parseFloat(manualAmount),
      type: manualType,
      category: 'Other',
      description: `Manually entered: ${manualMerchant}`,
      isTransfer: false,
    };
    onAdd(newTransaction);
    resetForm();
    onClose();
  };
  
  const resetForm = () => {
    setDescription('');
    setManualAmount('');
    setManualMerchant('');
    setManualType(TransactionType.Expense);
    setIsManualMode(false);
    setError(null);
    setTouched(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  }

  return (
    <BaseModal isOpen={isOpen} onClose={handleClose} title="Add Transaction">
      <div className="space-y-4">
        <div>
          <label htmlFor="accountId" className="block text-sm font-medium text-brand-gray-700">Account</label>
          <select id="accountId" value={accountId} onChange={(e) => setAccountId(e.target.value)} className="mt-1 block w-full rounded-md border-brand-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green" disabled={accounts.length === 0}>
            {accounts.length > 0 ? (
                accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)
            ) : (
                <option>Please add an account first</option>
            )}
          </select>
        </div>

        {isManualMode ? (
          <>
            <div>
              <label htmlFor="manualMerchant" className="block text-sm font-medium text-brand-gray-700">Merchant / Description</label>
              <input 
                type="text" 
                id="manualMerchant" 
                value={manualMerchant} 
                onChange={e => setManualMerchant(e.target.value)} 
                className={`mt-1 block w-full rounded-md shadow-sm focus:ring-brand-green focus:border-brand-green ${touched && !manualMerchant ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-brand-gray-300'}`} 
                placeholder="e.g., Naivas Westlands"
              />
              {touched && !manualMerchant && <p className="mt-1 text-xs text-red-500">Merchant name is required</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="manualAmount" className="block text-sm font-medium text-brand-gray-700">Amount</label>
                    <input 
                        type="number" 
                        id="manualAmount" 
                        value={manualAmount} 
                        onChange={e => setManualAmount(e.target.value)} 
                        className={`mt-1 block w-full rounded-md shadow-sm focus:ring-brand-green focus:border-brand-green ${touched && !manualAmount ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-brand-gray-300'}`} 
                        placeholder="2350.50"
                    />
                    {touched && !manualAmount && <p className="mt-1 text-xs text-red-500">Amount is required</p>}
                </div>
                <div>
                     <label htmlFor="manualType" className="block text-sm font-medium text-brand-gray-700">Type</label>
                     <select id="manualType" value={manualType} onChange={e => setManualType(e.target.value as TransactionType)} className="mt-1 block w-full rounded-md border-brand-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green">
                        <option value={TransactionType.Expense}>Expense</option>
                        <option value={TransactionType.Income}>Income</option>
                     </select>
                </div>
            </div>
          </>
        ) : (
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-brand-gray-700">Describe Transaction</label>
            <textarea 
                id="description" 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                rows={3} 
                className={`mt-1 block w-full rounded-md shadow-sm focus:ring-brand-green focus:border-brand-green ${touched && !description ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-brand-gray-300'}`} 
                placeholder="e.g., Lipa na M-PESA to Naivas Westlands for 2,350.50"
            ></textarea>
             {touched && !description && <p className="mt-1 text-xs text-red-500">Please enter a description</p>}
            <p className="mt-1 text-xs text-brand-gray-500">Our AI will parse the details for you.</p>
          </div>
        )}
        
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="text-center">
            <button onClick={() => setIsManualMode(!isManualMode)} className="text-xs text-brand-green hover:underline">
                {isManualMode ? 'Use AI Parser' : 'Enter Manually Instead'}
            </button>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={handleClose}>Cancel</Button>
        {isManualMode ? (
            <Button onClick={handleManualAdd}>Add Manually</Button>
        ) : (
            <Button onClick={handleAdd} disabled={isLoading}>
                {isLoading ? <Spinner size="sm" /> : "Add Transaction"}
            </Button>
        )}
      </div>
    </BaseModal>
  );
};

export default AddTransactionModal;
