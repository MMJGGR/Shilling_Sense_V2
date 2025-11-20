
import React, { useState, useEffect } from 'react';
import { Account, CategorizationExample, ParsedTransaction, Transaction, TransactionType } from '../../types';
import BaseModal from './BaseModal';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import { UploadCloud, Calendar, ShoppingBag, Hash, Tag, Download, FileText, History, CheckCircle2, ArrowRight } from 'lucide-react';
import { parseTransactionsFromFile, batchEnrichTransactions, TransactionToEnrich } from '../../services/geminiService';
import { getCachedEnrichment } from '../../services/cachingService';
import { extractHeuristicData } from '../../services/heuristicService';
import { getCategoryForMerchant } from '../../services/merchantCategoryMapService';
import CategoryEditor from '../CategoryEditor';
import VirtualList from '../ui/VirtualList';

interface ImportTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (transactions: Omit<Transaction, 'id'>[]) => void;
  accounts: Account[];
  categorizationExamples: CategorizationExample[];
  categories: string[];
  isInitialOnboarding?: boolean;
}

type Step = 'intro' | 'selectAccount' | 'upload' | 'review' | 'loading';

const ImportTransactionsModal: React.FC<ImportTransactionsModalProps> = ({ isOpen, onClose, onImport, accounts, categorizationExamples, categories, isInitialOnboarding = false }) => {
  const [step, setStep] = useState<Step>(isInitialOnboarding ? 'intro' : 'selectAccount');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id || '');
  const [file, setFile] = useState<File | null>(null);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Analyzing your statement...');
  const [enrichmentStatus, setEnrichmentStatus] = useState({ processed: 0, total: 0 });
  const [parsingMethod, setParsingMethod] = useState<'local' | 'ai'>('ai');

  useEffect(() => {
    if (isOpen && accounts.length > 0) {
      const isValidSelection = accounts.some(a => a.id === selectedAccountId);
      if (!selectedAccountId || !isValidSelection) {
        setSelectedAccountId(accounts[0].id);
      }
    }
  }, [accounts, selectedAccountId, isOpen]);

  useEffect(() => {
    if (isOpen && isInitialOnboarding) {
      setStep('intro');
    } else if (isOpen && step === 'intro' && !isInitialOnboarding) {
      setStep('selectAccount');
    }
  }, [isOpen, isInitialOnboarding]);

  const resetState = () => {
    setStep('selectAccount');
    setSelectedAccountId(accounts.length > 0 ? accounts[0].id : '');
    setFile(null);
    setParsedTransactions([]);
    setError(null);
    setEnrichmentStatus({ processed: 0, total: 0 });
    setParsingMethod('ai');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const sanitizeTransaction = (tx: any): ParsedTransaction => {
    let amount = parseFloat(String(tx.amount).replace(/[^0-9.-]+/g, ""));
    if (isNaN(amount)) amount = 0;
    let date = tx.date;
    if (!date || isNaN(new Date(date).getTime())) {
      date = new Date().toISOString().split('T')[0];
    }
    return {
      description: tx.description || 'Unknown Transaction',
      date: date,
      amount: Math.abs(amount),
      type: (tx.type === 'income' || tx.type === TransactionType.Income) ? TransactionType.Income : TransactionType.Expense,
      merchant: tx.merchant,
      category: tx.category
    };
  };

  const parseCSVLocally = (text: string): ParsedTransaction[] | null => {
    try {
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) return null;
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
      const dateIdx = headers.findIndex(h => h.includes('date'));
      const descIdx = headers.findIndex(h => h.includes('description') || h.includes('details') || h.includes('narration'));
      const amountIdx = headers.findIndex(h => h === 'amount' || h.includes('value'));
      const debitIdx = headers.findIndex(h => h.includes('debit') || h.includes('withdrawal'));
      const creditIdx = headers.findIndex(h => h.includes('credit') || h.includes('deposit'));

      if (dateIdx === -1 || descIdx === -1) return null;
      const results: ParsedTransaction[] = [];
      const csvSplitRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(csvSplitRegex).map(cell => cell.trim().replace(/^"|"$/g, ''));
        if (row.length < headers.length) continue;
        const dateStr = row[dateIdx];
        const description = row[descIdx];
        let amount = 0;
        let type = TransactionType.Expense;

        if (debitIdx !== -1 && creditIdx !== -1) {
          const debitVal = parseFloat(row[debitIdx].replace(/,/g, '')) || 0;
          const creditVal = parseFloat(row[creditIdx].replace(/,/g, '')) || 0;
          if (creditVal > 0) { amount = creditVal; type = TransactionType.Income; }
          else { amount = debitVal; type = TransactionType.Expense; }
        } else if (amountIdx !== -1) {
          const rawAmt = parseFloat(row[amountIdx].replace(/,/g, ''));
          if (!isNaN(rawAmt)) { amount = Math.abs(rawAmt); type = rawAmt < 0 ? TransactionType.Expense : TransactionType.Income; }
        }

        if (description && (amount > 0 || (debitIdx !== -1))) {
          const dateObj = new Date(dateStr);
          const validDate = !isNaN(dateObj.getTime()) ? dateObj.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
          results.push({ date: validDate, description, amount, type, merchant: description, category: undefined });
        }
      }
      return results.length > 0 ? results : null;
    } catch (e) {
      return null;
    }
  };

  const handleProcessFile = async () => {
    if (!file) return;
    setStep('loading');
    setError(null);

    try {
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        const text = await file.text();
        const localResult = parseCSVLocally(text);
        if (localResult) {
          setParsingMethod('local');
          setParsedTransactions(localResult);
          setStep('review');
          return;
        }
      }
      setParsingMethod('ai');
      setLoadingMessage("Complex file detected. Using AI to analyze...");
      const result = await parseTransactionsFromFile(file);
      const sanitized = result.map(sanitizeTransaction);
      setParsedTransactions(sanitized);
      setStep('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unknown error occurred.");
      setStep('upload');
    }
  };

  useEffect(() => {
    if (step === 'review' && parsedTransactions.length > 0) {
      setEnrichmentStatus({ processed: 0, total: parsedTransactions.length });
      const enrichAll = async () => {
        const transactionsToEnrich: TransactionToEnrich[] = [];
        let updatedTransactions = [...parsedTransactions];
        let processedOnDevice = 0;

        updatedTransactions.forEach((tx, index) => {
          const { merchant: identifiedMerchant, cacheKey } = extractHeuristicData(tx.description);
          if (identifiedMerchant) {
            const mappedCategory = getCategoryForMerchant(identifiedMerchant);
            if (mappedCategory) {
              updatedTransactions[index] = { ...tx, merchant: identifiedMerchant, category: mappedCategory };
              processedOnDevice++;
              return;
            }
          }
          const cachedData = getCachedEnrichment(cacheKey);
          if (cachedData) {
            updatedTransactions[index] = { ...tx, merchant: identifiedMerchant || cachedData.merchant, ...cachedData };
            processedOnDevice++;
          } else {
            transactionsToEnrich.push({ index, description: tx.description, cacheKey, identifiedMerchant: identifiedMerchant || undefined });
          }
        });

        setParsedTransactions(updatedTransactions);
        setEnrichmentStatus({ processed: processedOnDevice, total: parsedTransactions.length });

        if (transactionsToEnrich.length > 0) {
          try {
            const batchResults = await batchEnrichTransactions(transactionsToEnrich, categorizationExamples);
            setParsedTransactions(prev => {
              const finalUpdated = [...prev];
              batchResults.forEach(result => {
                if (finalUpdated[result.index]) {
                  finalUpdated[result.index] = { ...finalUpdated[result.index], ...result };
                }
              });
              return finalUpdated;
            });
            setEnrichmentStatus(prev => ({ ...prev, processed: prev.processed + batchResults.length }));
          } catch (apiError) {
            setError("AI enrichment partially failed. Please review.");
          }
        }
      };
      enrichAll();
    }
  }, [step, categorizationExamples, parsedTransactions.length]);

  const handleUpdateTransaction = (index: number, field: keyof ParsedTransaction, value: any) => {
    const updated = [...parsedTransactions];
    updated[index] = { ...updated[index], [field]: value };
    setParsedTransactions(updated);
  };

  const handleConfirmImport = () => {
    const newTransactions: Omit<Transaction, 'id'>[] = parsedTransactions.map(pt => {
      let logoUrl: string | undefined;
      // @ts-ignore 
      const website = pt.enrichedInfo?.website;
      try {
        if (website && (website.startsWith('http://') || website.startsWith('https://'))) {
          logoUrl = new URL(website).hostname;
        }
      } catch (e) { logoUrl = undefined; }
      const safeAmount = typeof pt.amount === 'number' && !isNaN(pt.amount) ? pt.amount : 0;

      return {
        accountId: selectedAccountId,
        date: pt.date,
        merchant: (pt.merchant || 'Untitled'),
        amount: safeAmount,
        type: pt.type,
        category: (pt.category || 'Other'),
        description: pt.description,
        logoUrl: logoUrl,
        isTransfer: pt.category === 'Internal Transfer',
      };
    });
    onImport(newTransactions);
    handleClose();
  };

  const renderReviewItem = (tx: ParsedTransaction, index: number) => (
    <div className="p-4 rounded-lg border border-brand-gray-200 bg-brand-gray-50/50 mb-3 mx-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="col-span-1 sm:col-span-2">
          <label className="flex items-center gap-2 text-xs font-medium text-brand-gray-500 mb-1"><ShoppingBag size={14} /> Merchant</label>
          <input type="text" value={tx.merchant || ''} onChange={e => handleUpdateTransaction(index, 'merchant', e.target.value)} className="w-full border-brand-gray-300 rounded-md shadow-sm sm:text-sm p-2 focus:ring-brand-green focus:border-brand-green" />
        </div>
        <div>
          <label className="flex items-center gap-2 text-xs font-medium text-brand-gray-500 mb-1"><Hash size={14} /> Amount</label>
          <input type="number" value={tx.amount} onChange={e => handleUpdateTransaction(index, 'amount', parseFloat(e.target.value))} className="w-full border-brand-gray-300 rounded-md shadow-sm sm:text-sm p-2 focus:ring-brand-green focus:border-brand-green" />
        </div>
        <div>
          <label className="flex items-center gap-2 text-xs font-medium text-brand-gray-500 mb-1"><Calendar size={14} /> Date</label>
          <input type="date" value={tx.date} onChange={e => handleUpdateTransaction(index, 'date', e.target.value)} className="w-full border-brand-gray-300 rounded-md shadow-sm sm:text-sm p-2 focus:ring-brand-green focus:border-brand-green" />
        </div>
        <div className="col-span-1 sm:col-span-2">
          <label className="flex items-center gap-2 text-xs font-medium text-brand-gray-500 mb-1"><Tag size={14} /> Category</label>
          <CategoryEditor
            value={tx.category || ''}
            onChange={value => handleUpdateTransaction(index, 'category', value)}
            onBlur={() => { }}
            categories={categories}
          />
        </div>
      </div>
    </div>
  );

  const isEnriching = enrichmentStatus.processed < enrichmentStatus.total;

  const renderContent = () => {
    switch (step) {
      case 'intro':
        return (
          <div className="text-center py-6">
            <div className="bg-brand-green-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm"><History className="h-10 w-10 text-brand-green" /></div>
            <h3 className="text-xl font-bold text-brand-gray-900 mb-3">Unlock Your Financial Insights</h3>
            <p className="text-brand-gray-600 max-w-md mx-auto mb-6 text-sm leading-relaxed">We recommend uploading <strong>3-12 months</strong> of history.</p>
            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <Button onClick={() => setStep('selectAccount')} className="w-full py-3 text-base shadow-lg shadow-brand-green/20">Upload Statement <ArrowRight size={16} className="ml-2 inline" /></Button>
              <button onClick={onClose} className="text-brand-gray-400 text-xs hover:text-brand-gray-600 font-medium py-2">I'll do this later</button>
            </div>
          </div>
        );
      case 'selectAccount':
        return (
          <>
            <p className="text-brand-gray-600 mb-4">Which account is this statement for?</p>
            {accounts.length === 0 ? (
              <div className="text-center p-4 border border-yellow-200 bg-yellow-50 rounded-lg"><p className="text-sm text-yellow-800 mb-2">You need an account first.</p></div>
            ) : (
              <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} className="w-full rounded-md border-brand-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green">
                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
              </select>
            )}
            <div className="mt-6 flex justify-end gap-3">
              {isInitialOnboarding && <Button variant="ghost" onClick={() => setStep('intro')}>Back</Button>}
              <Button onClick={() => setStep('upload')} disabled={!selectedAccountId}>Next</Button>
            </div>
          </>
        );
      case 'upload':
        return (
          <>
            <div className="mt-4 flex justify-center rounded-lg border border-dashed border-gray-900/25 px-6 py-10">
              <div className="text-center">
                <UploadCloud className="mx-auto h-12 w-12 text-gray-300" />
                <div className="mt-4 flex text-sm leading-6 text-gray-600">
                  <label className="relative cursor-pointer rounded-md bg-white font-semibold text-brand-green hover:text-brand-green-500">
                    <span>Upload a file</span>
                    <input type="file" className="sr-only" onChange={handleFileChange} accept="image/*,application/pdf,text/csv,.csv" />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs leading-5 text-gray-600">PDF, CSV, PNG, JPG up to 10MB</p>
                {file && <p className="text-sm font-medium text-brand-gray-800 mt-2">{file.name}</p>}
              </div>
            </div>
            {error && <p className="text-sm text-red-600 mt-2 text-center">{error}</p>}
            <div className="mt-6 flex justify-between">
              <Button variant="secondary" onClick={() => setStep('selectAccount')}>Back</Button>
              <Button onClick={handleProcessFile} disabled={!file}>Process Statement</Button>
            </div>
          </>
        );
      case 'loading':
        return <div className="flex flex-col items-center justify-center h-48"><Spinner /><p className="mt-4 text-brand-gray-600">{loadingMessage}</p></div>;
      case 'review':
        return (
          <>
            {isEnriching ? (
              <div className="mb-4 text-center p-2 rounded-md bg-brand-green-50">
                <div className="flex items-center justify-center gap-2">
                  <Spinner size="sm" />
                  <span className="text-sm text-brand-green-700 font-medium">AI is enriching... ({enrichmentStatus.processed}/{enrichmentStatus.total})</span>
                </div>
              </div>
            ) : parsingMethod === 'local' && (
              <div className="mb-4 text-center p-2 rounded-md bg-blue-50 border border-blue-100"><div className="flex items-center justify-center gap-2 text-blue-700"><FileText size={14} /><span className="text-xs font-medium">Fast Import Active: CSV processed locally</span></div></div>
            )}

            {error && <p className="text-sm text-red-600 my-2 text-center">{error}</p>}

            <div className="h-[50vh] -mx-2">
              <VirtualList
                items={parsedTransactions}
                itemHeight={220} // Approx height of card + margin
                containerHeight={window.innerHeight * 0.5}
                renderItem={renderReviewItem}
                className="px-2"
              />
            </div>

            <div className="mt-6 flex justify-between">
              <Button variant="secondary" onClick={() => setStep('upload')}>Back</Button>
              <Button onClick={handleConfirmImport} disabled={isEnriching}>Confirm and Add ({parsedTransactions.length})</Button>
            </div>
          </>
        );
    }
  };

  const backdropShouldClose = step !== 'review' && step !== 'loading' && step !== 'intro';

  return (
    <BaseModal isOpen={isOpen} onClose={handleClose} title={step === 'intro' ? "Setup" : "Import Statement"} backdropClosable={backdropShouldClose}>
      {renderContent()}
    </BaseModal>
  );
};

export default ImportTransactionsModal;
