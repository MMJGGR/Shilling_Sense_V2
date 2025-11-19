import React, { useState } from 'react';
import { Transaction, Category } from '../types';

interface TransactionItemProps {
  transaction: Transaction;
  accountName: string;
  onUpdateCategory: (transactionId: string, newCategory: Category) => void;
  onEdit: (transaction: Transaction) => void;
  categories: Category[];
}

const TransactionItem: React.FC<TransactionItemProps> = ({ transaction, accountName, onEdit }) => {
  const [logoError, setLogoError] = useState(false);
  
  const merchantName = transaction.merchant || 'Untitled Transaction';
  const merchantInitial = (transaction.merchant || '?').charAt(0).toUpperCase();

  return (
    <li 
      className={`group flex items-center justify-between px-4 py-3 sm:px-6 transition-all cursor-pointer border-b border-brand-gray-100 last:border-0 ${transaction.isTransfer ? 'opacity-60 hover:opacity-100 bg-brand-gray-50/50' : 'hover:bg-brand-green-50/30'}`}
      onClick={() => onEdit(transaction)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onEdit(transaction)}
      aria-label={`Edit transaction: ${merchantName} for KES ${transaction.amount}`}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-gray-100 group-hover:bg-white group-hover:shadow-sm transition-all">
          {transaction.logoUrl && !logoError ? (
            <img src={`https://logo.clearbit.com/${transaction.logoUrl}`} alt={`${merchantName} logo`} className="h-6 w-6 object-contain" onError={() => setLogoError(true)} />
          ) : (
            <span className="text-lg font-bold text-brand-green">{merchantInitial}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-brand-gray-900 text-sm sm:text-base">{merchantName}</p>
          <p className="text-xs text-brand-gray-500 truncate">{accountName}</p>
        </div>
      </div>
      <div className="text-right flex-shrink-0 ml-2">
        <p className={`font-bold text-sm sm:text-base ${transaction.type === 'income' ? 'text-brand-green' : 'text-brand-gray-900'}`}>
          {transaction.type === 'income' ? '+' : '-'} {transaction.amount.toLocaleString()}
        </p>
        <div className="mt-1">
             <span className="inline-block max-w-[100px] truncate rounded-full bg-brand-gray-100 px-2 py-0.5 text-[10px] font-medium text-brand-gray-600 group-hover:bg-brand-green-100 group-hover:text-brand-green-800 transition-colors">
                {transaction.category}
              </span>
        </div>
      </div>
    </li>
  );
};

export default TransactionItem;