
import React, { useState, useEffect, useMemo } from 'react';
import { Account, Transaction, TransactionType, AccountType } from './types';
import { useFinancialContext } from './contexts/FinancialContext';
import useUrlState from './hooks/useUrlState';
import AccountsModal from './components/modals/AccountsModal';
import AddTransactionModal from './components/modals/AddTransactionModal';
import EditTransactionModal from './components/modals/EditTransactionModal';
import ImportTransactionsModal from './components/modals/ImportTransactionsModal';
import Button from './components/ui/Button';
import { Plus, Upload, Award, Wallet, Banknote, Smartphone, ArrowDownCircle, ArrowUpCircle, Scale, Repeat, CalendarRange, Sliders, Calendar, LayoutDashboard, PieChart as PieChartIcon, Lock } from 'lucide-react';
import TransactionItem from './components/TransactionItem';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid, Sector } from 'recharts';
import Logo from './components/ui/Logo';
import Card from './components/ui/Card';
import ReconciliationModal from './components/modals/ReconciliationModal';
import ChatAssistant from './components/ChatAssistant';
import { ChamaWidget, DebtWidget, LoyaltyWidget, PriceWatchWidget } from './components/DashboardWidgets';
import BudgetView from './components/BudgetView';
import BudgetModal from './components/modals/BudgetModal';
import OnboardingModal from './components/modals/OnboardingModal';
import VirtualList from './components/ui/VirtualList';

// Toast Component
const Toast: React.FC<{ message: string; show: boolean; type: 'info' | 'warning'; onDismiss: () => void }> = ({ message, show, type, onDismiss }) => {
    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => {
                onDismiss();
            }, 3500);
            return () => clearTimeout(timer);
        }
    }, [show, onDismiss]);

    return (
        <div className={`fixed bottom-5 right-5 z-50 transition-transform transform ${show ? 'translate-y-0' : 'translate-y-20'} ease-out duration-300`}>
            <div className={`flex items-center gap-3 text-white py-3 px-5 rounded-lg shadow-lg ${type === 'warning' ? 'bg-orange-600' : 'bg-brand-gray-800'}`}>
                <Award className={type === 'warning' ? 'text-white' : 'text-yellow-400'} />
                <span>{message}</span>
            </div>
        </div>
    );
};

const KESFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'KES',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-xl border border-gray-100">
                <p className="text-xs text-gray-500 mb-1 font-medium uppercase">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <p key={index} className="text-sm font-bold" style={{ color: entry.color }}>
                        {entry.name}: {KESFormatter.format(entry.value)}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const getStartOfWeek = (d: string): string => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); 
  return new Date(new Date(date.setDate(diff)).setHours(0, 0, 0, 0)).toISOString().split('T')[0];
};

const getStartOfMonth = (d: string): string => {
    const date = new Date(d);
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
};

const getFriendlyDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

type Period = 'this_month' | 'last_month' | 'this_quarter' | 'ytd' | 'all_time';
type Tab = 'overview' | 'budgets';

const PERIOD_LABELS: Record<Period, string> = {
    this_month: 'This Month',
    last_month: 'Last Month',
    this_quarter: 'This Quarter',
    ytd: 'Year to Date',
    all_time: 'All Time'
};

const App: React.FC = () => {
  const { 
      accounts, setAccounts, 
      transactions, setTransactions,
      categories, setCategories,
      budgets, setBudgets,
      userProfile, setUserProfile,
      loyaltyCards, setLoyaltyCards,
      debts, setDebts,
      chamas, setChamas,
      categorizationExamples,
      addTransaction, updateTransaction, deleteTransaction, updateCategory, importTransactions, addBudget,
      notification, dismissNotification
  } = useFinancialContext();

  // URL State for Persistence
  const [activeTab, setActiveTab] = useUrlState<Tab>('tab', 'overview');
  const [selectedPeriod, setSelectedPeriod] = useUrlState<Period>('period', 'this_month');
  
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isOnboardingImport, setIsOnboardingImport] = useState(false);
  const [isReconciliationModalOpen, setIsReconciliationModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [pieGranularity, setPieGranularity] = useState<number>(5);
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null);

  useEffect(() => {
      if (!userProfile && accounts.length === 0) {
          const timer = setTimeout(() => setIsOnboardingModalOpen(true), 500);
          return () => clearTimeout(timer);
      }
  }, [userProfile, accounts.length]);

  const handleSaveProfile = (profile: any) => {
      setUserProfile(profile);
      setIsOnboardingModalOpen(false);
      if (accounts.length > 0) {
          setIsOnboardingImport(true);
          setTimeout(() => setIsImportModalOpen(true), 800);
      }
  };

  const filteredTransactions = useMemo<Transaction[]>(() => {
      const now = new Date();
      return transactions.filter(t => {
          const tDate = new Date(t.date);
          switch(selectedPeriod) {
            case 'this_month':
                return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
            case 'last_month':
                const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                return tDate.getMonth() === lastMonthDate.getMonth() && tDate.getFullYear() === lastMonthDate.getFullYear();
            case 'this_quarter':
                const currentQuarter = Math.floor((now.getMonth() + 3) / 3);
                const tQuarter = Math.floor((tDate.getMonth() + 3) / 3);
                return tQuarter === currentQuarter && tDate.getFullYear() === now.getFullYear();
            case 'ytd':
                return tDate.getFullYear() === now.getFullYear();
            case 'all_time':
                return true;
            default:
                return true;
          }
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, selectedPeriod]);

  const accountBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    accounts.forEach(acc => { balances[acc.id] = acc.initialBalance; });
    [...transactions].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).forEach(tx => {
        if (balances[tx.accountId] !== undefined) {
            balances[tx.accountId] += tx.type === TransactionType.Income ? tx.amount : -tx.amount;
        }
    });
    return balances;
  }, [accounts, transactions]);

  const totalBalance = useMemo(() => Object.values(accountBalances).reduce((sum, bal) => sum + bal, 0), [accountBalances]);

  const stats = useMemo(() => {
      return filteredTransactions.reduce((acc, tx) => {
        if (tx.isTransfer) return acc;
        const amount = typeof tx.amount === 'number' ? tx.amount : (Number(tx.amount) || 0);
        if (tx.type === TransactionType.Income) acc.income += amount;
        else acc.expense += amount;
        return acc;
      }, { income: 0, expense: 0 });
  }, [filteredTransactions]);

  const cashflowTrendData = useMemo(() => {
    const trends: { [key: string]: { income: number, expense: number, name: string, sortDate: string } } = {};
    const isLongPeriod = selectedPeriod === 'ytd' || selectedPeriod === 'all_time';
    const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' });
    const weekFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
    
    [...filteredTransactions].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).forEach(tx => {
        if (tx.isTransfer) return;
        const key = isLongPeriod ? getStartOfMonth(tx.date) : getStartOfWeek(tx.date);
        const label = isLongPeriod ? monthFormatter.format(new Date(key)) : weekFormatter.format(new Date(key));
        
        if (!trends[key]) trends[key] = { income: 0, expense: 0, name: label, sortDate: key };
        const amount = typeof tx.amount === 'number' ? tx.amount : (Number(tx.amount) || 0);
        if (tx.type === 'income') trends[key].income += amount;
        else trends[key].expense += amount;
    });
    return Object.values(trends).sort((a,b) => new Date(a.sortDate).getTime() - new Date(b.sortDate).getTime());
  }, [filteredTransactions, selectedPeriod]);

  const expenseData = useMemo(() => filteredTransactions
    .filter(t => t.type === 'expense' && !t.isTransfer)
    .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + (typeof t.amount === 'number' ? t.amount : (Number(t.amount) || 0));
        return acc;
    }, {} as Record<string, number>), [filteredTransactions]);

  const processedPieData = useMemo(() => {
      const chartData = Object.entries(expenseData).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
      if (chartData.length <= pieGranularity) return chartData;
      const top = chartData.slice(0, pieGranularity);
      const others = chartData.slice(pieGranularity);
      return [...top, { name: 'Others', value: others.reduce((sum, item) => sum + item.value, 0) }];
  }, [expenseData, pieGranularity]);

  const PIE_COLORS = ['#066245', '#0A845C', '#0DA774', '#10B981', '#42C795', '#71D5B0', '#A0E3CB', '#D0F1E6'];
  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return <g><Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8} startAngle={startAngle} endAngle={endAngle} fill={fill} stroke={fill} strokeWidth={2} /></g>;
  };

  const getAccountIcon = (type: AccountType) => {
    switch(type) {
        case AccountType.MobileMoney: return <Smartphone size={20} />;
        case AccountType.BankAccount: return <Banknote size={20} />;
        case AccountType.Cash: return <Wallet size={20} />;
        default: return <Wallet size={20} />;
    }
  };

  const handleAddAccount = (accountData: Omit<Account, 'id'>) => {
      setAccounts(prev => [...prev, { ...accountData, id: Date.now().toString() }]);
  };

  const handleReconcileTransactions = (pairs: string[][]) => {
      const linkedIds = new Set(pairs.flat());
      setTransactions(prev => prev.map(t => linkedIds.has(t.id) ? { ...t, isTransfer: true, category: "Internal Transfer" } : t));
  };

  // Virtual List Render Logic
  const renderTransactionItem = (tx: Transaction, index: number) => (
      <TransactionItem 
          key={tx.id} 
          transaction={tx}
          accountName={accounts.find(a => a.id === tx.accountId)?.name || 'Unknown'}
          onUpdateCategory={updateCategory}
          onEdit={(t) => { setEditingTransaction(t); setIsEditModalOpen(true); }}
          categories={categories}
      />
  );

  return (
    <div className="min-h-screen bg-brand-gray-100 font-sans text-brand-gray-900 pb-20">
      <div className="flex-1 flex flex-col">
        <header className="sticky top-0 z-40 flex-shrink-0 bg-white/80 backdrop-blur-sm border-b border-brand-gray-200">
          <div className="flex items-center justify-between h-20 px-4 sm:px-8">
            <div className="flex items-center gap-3">
              <Logo className="h-9 w-9" />
              <span className="text-xl font-bold text-brand-gray-800 hidden sm:block">Shilling Sense</span>
            </div>
            
            <div className="flex bg-brand-gray-100 rounded-lg p-1">
                <button onClick={() => setActiveTab('overview')} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'overview' ? 'bg-white text-brand-green shadow-sm' : 'text-brand-gray-500 hover:text-brand-gray-800'}`}><LayoutDashboard size={16} /><span className="hidden sm:inline">Overview</span></button>
                <button onClick={() => setActiveTab('budgets')} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'budgets' ? 'bg-white text-brand-green shadow-sm' : 'text-brand-gray-500 hover:text-brand-gray-800'}`}><PieChartIcon size={16} /><span className="hidden sm:inline">Budgets</span></button>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={() => setIsReconciliationModalOpen(true)} disabled={transactions.length < 2} size="sm" variant="ghost"><Repeat className="mr-0 sm:mr-2 h-4 w-4"/><span className="hidden sm:inline">Reconcile</span></Button>
              <Button onClick={() => setIsImportModalOpen(true)} disabled={accounts.length === 0} size="sm" variant="secondary"><Upload className="mr-0 sm:mr-2 h-4 w-4"/><span className="hidden sm:inline">Import</span></Button>
              <Button onClick={() => setIsTransactionModalOpen(true)} disabled={accounts.length === 0} size="sm"><Plus className="mr-0 sm:mr-2 h-4 w-4"/><span className="hidden sm:inline">New Transaction</span></Button>
            </div>
          </div>
        </header>
        
        <main className="flex-1 p-4 sm:p-8">
          {activeTab === 'overview' ? (
              <>
                <div className="flex justify-center mb-6 overflow-x-auto">
                    <div className="flex bg-brand-gray-200 rounded-full p-1 space-x-1">
                        {(Object.keys(PERIOD_LABELS) as Period[]).map((period) => (
                            <button key={period} onClick={() => setSelectedPeriod(period)} className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap ${selectedPeriod === period ? 'bg-white text-brand-green shadow-sm' : 'text-brand-gray-600 hover:text-brand-gray-900'}`}>{PERIOD_LABELS[period]}</button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-6 sm:gap-8">
                    {transactions.length === 0 ? (
                        <Card className="col-span-12 p-8 bg-gradient-to-br from-brand-green-50 to-white border-brand-green-100 text-center">
                            <div className="max-w-2xl mx-auto">
                                <div className="bg-white w-16 h-16 rounded-full shadow-sm flex items-center justify-center mx-auto mb-4 text-brand-green"><Upload size={32} /></div>
                                <h2 className="text-2xl font-bold text-brand-gray-900 mb-2">Welcome, {userProfile?.name || 'Financial Pro'}!</h2>
                                <p className="text-brand-gray-600 mb-8 text-lg">To generate your budget and insights, Shilling Sense needs data. <br/><strong>Upload your last 3-12 months of transaction history</strong> (PDF/CSV) to get started immediately.</p>
                                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                    {accounts.length === 0 ? (
                                         <Button onClick={() => setIsAccountModalOpen(true)} size="lg" className="shadow-lg shadow-brand-green/20"><Plus className="mr-2 h-5 w-5" /> Add Your First Account</Button>
                                    ) : (
                                        <>
                                            <Button onClick={() => { setIsOnboardingImport(true); setIsImportModalOpen(true); }} size="lg" className="shadow-lg shadow-brand-green/20"><Upload className="mr-2 h-5 w-5" /> Import Statement</Button>
                                            <Button onClick={() => setIsTransactionModalOpen(true)} variant="secondary" size="lg"><Plus className="mr-2 h-5 w-5" /> Add Manually</Button>
                                        </>
                                    )}
                                </div>
                                <p className="text-xs text-brand-gray-400 mt-6 flex items-center justify-center gap-1"><Lock size={12} /> Your data is processed locally and securely.</p>
                            </div>
                        </Card>
                    ) : (
                        <>
                            <Card className="col-span-12 md:col-span-6 lg:col-span-3 p-5">
                                <h3 className="text-sm font-medium text-brand-gray-500">Total Balance</h3>
                                <p className="text-3xl font-bold text-brand-gray-900 mt-2">{KESFormatter.format(totalBalance)}</p>
                                <p className="text-xs text-brand-gray-400 mt-1">Across all accounts</p>
                            </Card>
                            <Card className="col-span-6 md:col-span-3 lg:col-span-3 p-5 flex flex-col">
                                <div className="flex items-center gap-2">
                                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center"><ArrowDownCircle size={16}/></div>
                                    <h3 className="text-sm font-medium text-brand-gray-500">Income</h3>
                                </div>
                                <p className="text-2xl font-bold text-green-600 mt-2">{KESFormatter.format(stats.income)}</p>
                            </Card>
                            <Card className="col-span-6 md:col-span-3 lg:col-span-3 p-5 flex flex-col">
                                <div className="flex items-center gap-2">
                                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center"><ArrowUpCircle size={16}/></div>
                                    <h3 className="text-sm font-medium text-brand-gray-500">Expenses</h3>
                                </div>
                                <p className="text-2xl font-bold text-red-600 mt-2">{KESFormatter.format(stats.expense)}</p>
                            </Card>
                            <Card className="col-span-12 md:col-span-6 lg:col-span-3 p-5 flex flex-col">
                                <div className="flex items-center gap-2">
                                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><Scale size={16}/></div>
                                    <h3 className="text-sm font-medium text-brand-gray-500">Net Flow</h3>
                                </div>
                                <p className={`text-2xl font-bold mt-2 ${stats.income - stats.expense >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{KESFormatter.format(stats.income - stats.expense)}</p>
                            </Card>
                        </>
                    )}

                    <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <LoyaltyWidget cards={loyaltyCards} onAdd={card => setLoyaltyCards(prev => [...prev, card])} onDelete={id => setLoyaltyCards(prev => prev.filter(c => c.id !== id))} />
                        <DebtWidget debts={debts} onAdd={debt => setDebts(prev => [...prev, debt])} onDelete={id => setDebts(prev => prev.filter(d => d.id !== id))} />
                        <ChamaWidget chamas={chamas} onAdd={chama => setChamas(prev => [...prev, chama])} />
                        <PriceWatchWidget transactions={transactions} />
                    </div>
                    
                    <Card className="col-span-12 lg:col-span-12 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-brand-gray-800">Accounts</h3>
                            <Button variant="ghost" size="sm" onClick={() => setIsAccountModalOpen(true)}><Plus className="h-4 w-4 mr-0 sm:mr-2" /><span className="hidden sm:inline">Add Account</span></Button>
                        </div>
                        {accounts.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                {accounts.map(acc => (
                                    <div key={acc.id} className="border border-brand-gray-200 rounded-lg p-4 flex items-center gap-4 hover:bg-brand-gray-50 transition-colors">
                                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-brand-green-50 text-brand-green flex items-center justify-center">{getAccountIcon(acc.type)}</div>
                                        <div><p className="font-semibold text-brand-gray-800">{acc.name}</p><p className="text-sm text-brand-gray-700">{KESFormatter.format(accountBalances[acc.id] ?? 0)}</p></div>
                                    </div>
                                ))}
                            </div>
                        ) : <div className="text-center py-8"><p className="text-brand-gray-500">No accounts yet.</p><Button size="sm" className="mt-2" onClick={() => setIsAccountModalOpen(true)}>Add Account</Button></div>}
                    </Card>

                    {transactions.length > 0 && (
                        <>
                            <Card className="col-span-12">
                                <div className="p-6 border-b border-brand-gray-200 flex justify-between items-center">
                                    <h2 className="text-lg font-semibold text-brand-gray-800">Cash Flow Trend</h2>
                                    <span className="text-xs text-brand-gray-500 bg-brand-gray-100 px-2 py-1 rounded">{selectedPeriod === 'ytd' || selectedPeriod === 'all_time' ? 'Grouped by Month' : 'Grouped by Week'}</span>
                                </div>
                                <div className="p-6 h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={cashflowTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                                                </linearGradient>
                                                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                                                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" minTickGap={30} />
                                            <YAxis tickFormatter={(value) => `${value/1000}k`} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend />
                                            <Area type="monotone" dataKey="income" name="Income" stroke="#10B981" fillOpacity={1} fill="url(#colorIncome)" />
                                            <Area type="monotone" dataKey="expense" name="Expense" stroke="#EF4444" fillOpacity={1} fill="url(#colorExpense)" />
                                        </AreaChart>
                                </ResponsiveContainer>
                                </div>
                            </Card>

                            <Card className="col-span-12 lg:col-span-7 flex flex-col h-[500px]">
                                <div className="p-6 border-b border-brand-gray-200 flex-shrink-0"><h2 className="text-lg font-semibold text-brand-gray-800">Recent Transactions ({PERIOD_LABELS[selectedPeriod]})</h2></div>
                                <div className="flex-1 p-0">
                                    {filteredTransactions.length > 0 ? (
                                        <VirtualList 
                                            items={filteredTransactions}
                                            itemHeight={72} 
                                            containerHeight={430} 
                                            renderItem={renderTransactionItem}
                                        />
                                    ) : (
                                        <div className="text-center p-12"><h3 className="text-lg font-medium text-brand-gray-800">No transactions found</h3></div>
                                    )}
                                </div>
                            </Card>

                            <Card className="col-span-12 lg:col-span-5 flex flex-col h-[500px]">
                                <div className="p-6 border-b border-brand-gray-200 flex-shrink-0 flex justify-between items-center">
                                    <h2 className="text-lg font-semibold text-brand-gray-800">Expense Breakdown</h2>
                                    <div className="flex items-center gap-2"><Sliders size={14} className="text-gray-400" /><input type="range" min="3" max="15" value={pieGranularity} onChange={(e) => setPieGranularity(parseInt(e.target.value))} className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-green" /></div>
                                </div>
                                <div className="p-6 flex-1">
                                    {processedPieData.length > 0 ? (
                                    <div style={{width: '100%', height: '100%'}}>
                                        <ResponsiveContainer>
                                            <PieChart>
                                            <Pie 
                                                data={processedPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}
                                                {...({ activeIndex: activePieIndex ?? -1 } as any)}
                                                activeShape={renderActiveShape}
                                                onMouseEnter={(_, index) => setActivePieIndex(index)}
                                                onMouseLeave={() => setActivePieIndex(null)}
                                            >
                                                {processedPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.name === 'Others' ? '#E5E7EB' : PIE_COLORS[index % PIE_COLORS.length]} style={{ transition: 'opacity 0.2s', cursor: 'pointer' }} opacity={activePieIndex === null || activePieIndex === index ? 1 : 0.4} />)}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend iconSize={10} layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ cursor: 'pointer' }} onMouseEnter={(o) => setActivePieIndex(processedPieData.findIndex(d => d.name === o.value))} onMouseLeave={() => setActivePieIndex(null)} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    ) : <div className="text-center py-12 h-full flex items-center justify-center"><p className="text-brand-gray-500">No expense data for this period.</p></div>}
                                </div>
                            </Card>
                        </>
                    )}
                </div>
              </>
          ) : (
              <BudgetView 
                  budgets={budgets} transactions={transactions} userProfile={userProfile}
                  onAddBudget={() => setIsBudgetModalOpen(true)} 
                  onDelete={id => setBudgets(prev => prev.filter(b => b.id !== id))} 
                  onEdit={() => setIsBudgetModalOpen(true)}
              />
          )}
        </main>
      </div>
      
      <OnboardingModal isOpen={isOnboardingModalOpen} onSave={handleSaveProfile} />
      <AccountsModal isOpen={isAccountModalOpen} onClose={() => setIsAccountModalOpen(false)} onSave={handleAddAccount} />
      <ReconciliationModal isOpen={isReconciliationModalOpen} onClose={() => setIsReconciliationModalOpen(false)} transactions={transactions} onReconcile={handleReconcileTransactions} />
      <BudgetModal isOpen={isBudgetModalOpen} onClose={() => setIsBudgetModalOpen(false)} onSave={addBudget} categories={categories} transactions={transactions} userProfile={userProfile} existingBudgets={budgets} />
      
      {editingTransaction && (
          <EditTransactionModal
              isOpen={isEditModalOpen}
              onClose={() => { setIsEditModalOpen(false); setEditingTransaction(null); }}
              transaction={editingTransaction}
              onSave={updateTransaction}
              onDelete={deleteTransaction}
              accounts={accounts}
              categories={categories}
              setCategories={setCategories}
          />
      )}
      
      <ImportTransactionsModal
        isOpen={isImportModalOpen}
        onClose={() => { setIsImportModalOpen(false); setIsOnboardingImport(false); }}
        onImport={importTransactions}
        accounts={accounts}
        categorizationExamples={categorizationExamples}
        categories={categories}
        isInitialOnboarding={isOnboardingImport}
      />
      
      {accounts.length > 0 && (
        <>
          <AddTransactionModal isOpen={isTransactionModalOpen} onClose={() => setIsTransactionModalOpen(false)} onAdd={addTransaction} accounts={accounts} categorizationExamples={categorizationExamples} />
          <ChatAssistant contextData={{ transactions, loyaltyCards, debts, chamas }} />
        </>
      )}
      <Toast message={notification.message} show={notification.show} type={notification.type} onDismiss={dismissNotification} />
    </div>
  );
};

export default App;
