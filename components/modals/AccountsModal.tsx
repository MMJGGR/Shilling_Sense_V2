
import React, { useState } from 'react';
import { Account, AccountType } from '../../types';
import BaseModal from './BaseModal';
import Button from '../ui/Button';

interface AccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (account: Omit<Account, 'id'>) => void;
}

const AccountsModal: React.FC<AccountsModalProps> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>(AccountType.MobileMoney);
  const [balance, setBalance] = useState('');

  const handleSave = () => {
    if (name && balance) {
      onSave({ name, type, initialBalance: parseFloat(balance) });
      setName('');
      setType(AccountType.MobileMoney);
      setBalance('');
      onClose();
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Add New Account">
      <form onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-4">
          <div>
            <label htmlFor="accountName" className="block text-sm font-medium text-brand-gray-700">Account Name</label>
            <input type="text" id="accountName" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full rounded-md border-brand-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green" placeholder="e.g., M-PESA" />
          </div>
          <div>
            <label htmlFor="accountType" className="block text-sm font-medium text-brand-gray-700">Account Type</label>
            <select id="accountType" value={type} onChange={(e) => setType(e.target.value as AccountType)} className="mt-1 block w-full rounded-md border-brand-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green">
              {Object.values(AccountType).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="initialBalance" className="block text-sm font-medium text-brand-gray-700">Opening Balance (KES)</label>
            <input type="number" id="initialBalance" value={balance} onChange={(e) => setBalance(e.target.value)} className="mt-1 block w-full rounded-md border-brand-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green" placeholder="5000" />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name || !balance}>Save Account</Button>
        </div>
      </form>
    </BaseModal>
  );
};

export default AccountsModal;
