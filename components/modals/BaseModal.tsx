import React, { ReactNode } from 'react';
import { X } from 'lucide-react';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  backdropClosable?: boolean;
  maxWidth?: string;
}

const BaseModal: React.FC<BaseModalProps> = ({ isOpen, onClose, title, children, backdropClosable = true, maxWidth = 'max-w-md' }) => {
  if (!isOpen) return null;

  const handleBackdropClick = () => {
    if (backdropClosable) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-gray-800 bg-opacity-75" onClick={handleBackdropClick}>
      <div className={`relative w-full ${maxWidth} rounded-lg bg-white p-6 shadow-xl transition-all`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-4 border-b border-brand-gray-200">
          <h3 className="text-lg font-semibold text-brand-gray-900">{title}</h3>
          <button onClick={onClose} className="text-brand-gray-400 hover:text-brand-gray-600">
            <X size={24} />
          </button>
        </div>
        <div className="mt-4">
          {children}
        </div>
      </div>
    </div>
  );
};

export default BaseModal;