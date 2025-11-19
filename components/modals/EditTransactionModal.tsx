import React, { useState, useEffect } from 'react';
import { Account, Category, Transaction, TransactionType } from '../../types';
import BaseModal from './BaseModal';
import Button from '../ui/Button';
import CategoryEditor from '../CategoryEditor';
import { Trash2 } from 'lucide-react';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction;
  onSave: (transaction: Transaction) => void;
  onDelete: (transactionId: string) => void;
  accounts: Account[];
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
}

const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onSave,
  onDelete,
  accounts,
  categories,
  setCategories
}) => {
  const [editedTx, setEditedTx] = useState(transaction);

  useEffect(() => {
    setEditedTx(transaction);
  }, [transaction]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let finalValue: string | number = value;

    if (name === 'amount') {
        finalValue = parseFloat(value) || 0;
    }
    
    setEditedTx(prev => ({ ...prev, [name]: finalValue }));
  };
  
  const handleCategoryChange = (newCategory: string) => {
    setEditedTx(prev => ({...prev, category: newCategory, isTransfer: newCategory === 'Internal Transfer' }));
  }
  
  const handleCategoryBlur = () => {
    if (editedTx.category && !categories.includes(editedTx.category)) {
      setCategories(prev => [...prev, editedTx.category].sort());
    }
  }

  const handleSave = () => {
    onSave(editedTx);
  };
  
  const handleDelete = () => {
    if(window.confirm("Are you sure you want to delete this transaction? This action cannot be undone.")) {
        onDelete(transaction.id);
    }
  }

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Edit Transaction">
      <div className="space-y-4">
        <div>
          <label htmlFor="merchant" className="block text-sm font-medium text-brand-gray-700">Merchant</label>
          <input type="text" name="merchant" id="merchant" value={editedTx.merchant} onChange={handleChange} className="mt-1 block w-full rounded-md border-brand-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green" />
        </div>
         <div className="grid grid-cols-2 gap-4">
            <div>
                <label htmlFor="amount" className="block text-sm font-medium text-brand-gray-700">Amount</label>
                <input type="number" name="amount" id="amount" value={editedTx.amount} onChange={handleChange} className="mt-1 block w-full rounded-md border-brand-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green" />
            </div>
            <div>
                <label htmlFor="date" className="block text-sm font-medium text-brand-gray-700">Date</label>
                <input type="date" name="date" id="date" value={editedTx.date} onChange={handleChange} className="mt-1 block w-full rounded-md border-brand-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green" />
            </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="accountId" className="block text-sm font-medium text-brand-gray-700">Account</label>
              <select name="accountId" id="accountId" value={editedTx.accountId} onChange={handleChange} className="mt-1 block w-full rounded-md border-brand-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green">
                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-brand-gray-700">Type</label>
              <select name="type" id="type" value={editedTx.type} onChange={handleChange} className="mt-1 block w-full rounded-md border-brand-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green">
                <option value={TransactionType.Expense}>Expense</option>
                <option value={TransactionType.Income}>Income</option>
              </select>
            </div>
        </div>
        <div>
            <label htmlFor="category" className="block text-sm font-medium text-brand-gray-700">Category</label>
            <CategoryEditor
                value={editedTx.category}
                onChange={handleCategoryChange}
                onBlur={handleCategoryBlur}
                categories={categories}
            />
        </div>
      </div>
      <div className="mt-6 flex justify-between items-center">
        <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={handleDelete} aria-label="Delete transaction">
            <Trash2 size={16} />
        </Button>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </div>
    </BaseModal>
  );
};

export default EditTransactionModal;
