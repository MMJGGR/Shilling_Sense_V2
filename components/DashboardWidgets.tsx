
import React, { useState, useMemo } from 'react';
import { Chama, Debt, LoyaltyCard, Transaction } from '../types';
import Card from './ui/Card';
import Button from './ui/Button';
import { Plus, TrendingUp, Trash2, Users, Gift, AlertCircle, ArrowUpRight, ArrowDownLeft, CreditCard } from 'lucide-react';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';

const KESFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

const WidgetHeader: React.FC<{ title: string, icon: React.ReactNode, iconColorClass: string, onAdd?: () => void, isAdding?: boolean }> = ({ title, icon, iconColorClass, onAdd, isAdding }) => (
    <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${iconColorClass} shadow-sm`}>
                {icon}
            </div>
            <h3 className="font-bold text-gray-800 text-base">{title}</h3>
        </div>
        {onAdd && (
            <button 
                onClick={onAdd} 
                className={`p-1.5 rounded-full transition-all duration-200 ${isAdding ? 'bg-gray-100 text-gray-500 rotate-45' : 'bg-white text-brand-green hover:bg-green-50 border border-green-100 shadow-sm'}`}
            >
                <Plus size={18} />
            </button>
        )}
    </div>
);

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
    <input 
        {...props}
        className="w-full text-sm px-3 py-2.5 rounded-lg border border-gray-200 focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none transition-all bg-gray-50 focus:bg-white" 
    />
);

// --- LOYALTY WIDGET ---
interface LoyaltyWidgetProps {
    cards: LoyaltyCard[];
    onAdd: (card: LoyaltyCard) => void;
    onDelete: (id: string) => void;
}

export const LoyaltyWidget: React.FC<LoyaltyWidgetProps> = ({ cards, onAdd, onDelete }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [provider, setProvider] = useState('');
    const [points, setPoints] = useState('');

    const handleAdd = () => {
        if (provider && points) {
            onAdd({
                id: Date.now().toString(),
                provider,
                points: parseInt(points),
                lastUpdated: new Date().toISOString().split('T')[0]
            });
            setIsAdding(false);
            setProvider('');
            setPoints('');
        }
    };

    return (
        <Card className="p-6 flex flex-col h-full border border-gray-100 shadow-lg shadow-gray-200/40 transition-shadow hover:shadow-xl hover:shadow-gray-200/50">
            <WidgetHeader 
                title="Points Wallet" 
                icon={<Gift size={20} />} 
                iconColorClass="bg-purple-50 text-purple-600"
                onAdd={() => setIsAdding(!isAdding)}
                isAdding={isAdding}
            />
            
            {isAdding && (
                <div className="mb-4 p-4 bg-gray-50/80 rounded-xl border border-gray-100 space-y-3 animate-in fade-in slide-in-from-top-2">
                    <InputField placeholder="Provider (e.g. Naivas)" value={provider} onChange={e => setProvider(e.target.value)} autoFocus />
                    <InputField type="number" placeholder="Points Balance" value={points} onChange={e => setPoints(e.target.value)} />
                    <Button size="sm" className="w-full shadow-none" onClick={handleAdd}>Add Card</Button>
                </div>
            )}

            <div className="space-y-3 flex-1 overflow-y-auto pr-1 custom-scrollbar max-h-64">
                {cards.length === 0 && !isAdding ? (
                    <div className="h-32 flex flex-col items-center justify-center text-center text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                        <CreditCard size={24} className="mb-2 opacity-50" />
                        <p className="text-xs">No loyalty cards yet</p>
                    </div>
                ) : null}
                
                {cards.map(card => (
                    <div key={card.id} className="relative group overflow-hidden bg-white border border-gray-100 rounded-xl p-3.5 transition-all hover:border-purple-200 hover:shadow-md">
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="font-bold text-gray-800">{card.provider}</p>
                                <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">Last: {card.lastUpdated}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-black text-lg text-purple-600 tracking-tight">{card.points.toLocaleString()}</p>
                                <p className="text-[10px] text-purple-400 font-medium">PTS</p>
                            </div>
                        </div>
                        <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-purple-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
                        
                        <button 
                            onClick={() => onDelete(card.id)} 
                            className="absolute top-2 right-2 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all z-20"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </Card>
    );
};

// --- DEBT (DENI) WIDGET ---
interface DebtWidgetProps {
    debts: Debt[];
    onAdd: (debt: Debt) => void;
    onDelete: (id: string) => void;
}

export const DebtWidget: React.FC<DebtWidgetProps> = ({ debts, onAdd, onDelete }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [person, setPerson] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<'owed_to_me' | 'owed_by_me'>('owed_to_me');

    const handleAdd = () => {
        if (person && amount) {
            onAdd({
                id: Date.now().toString(),
                person,
                amount: parseFloat(amount),
                type,
                description: 'Manual Entry'
            });
            setIsAdding(false);
            setPerson('');
            setAmount('');
        }
    };

    const totalOwedToMe = debts.filter(d => d.type === 'owed_to_me').reduce((a, b) => a + b.amount, 0);
    const totalIOwe = debts.filter(d => d.type === 'owed_by_me').reduce((a, b) => a + b.amount, 0);
    const netPosition = totalOwedToMe - totalIOwe;

    return (
        <Card className="p-6 flex flex-col h-full border border-gray-100 shadow-lg shadow-gray-200/40 transition-shadow hover:shadow-xl hover:shadow-gray-200/50">
            <WidgetHeader 
                title="Deni Tracker" 
                icon={<AlertCircle size={20} />} 
                iconColorClass="bg-orange-50 text-orange-600"
                onAdd={() => setIsAdding(!isAdding)}
                isAdding={isAdding}
            />

            {!isAdding && (
                <div className="mb-6 p-4 bg-gradient-to-br from-gray-50 to-white border border-gray-100 rounded-xl text-center">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Net Position</p>
                    <p className={`text-2xl font-black ${netPosition >= 0 ? 'text-brand-green' : 'text-red-500'}`}>
                        {netPosition > 0 ? '+' : ''}{KESFormatter.format(netPosition)}
                    </p>
                    <div className="flex justify-center gap-4 mt-3 text-xs">
                        <span className="text-green-600 bg-green-50 px-2 py-1 rounded-md font-medium">In: {KESFormatter.format(totalOwedToMe)}</span>
                        <span className="text-red-600 bg-red-50 px-2 py-1 rounded-md font-medium">Out: {KESFormatter.format(totalIOwe)}</span>
                    </div>
                </div>
            )}

            {isAdding && (
                <div className="mb-4 p-4 bg-gray-50/80 rounded-xl border border-gray-100 space-y-3 animate-in fade-in slide-in-from-top-2">
                    <InputField placeholder="Person Name" value={person} onChange={e => setPerson(e.target.value)} autoFocus />
                    <div className="flex gap-2">
                        <InputField type="number" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} />
                        <select value={type} onChange={e => setType(e.target.value as any)} className="text-sm px-2 rounded-lg border border-gray-200 bg-white focus:border-brand-green outline-none">
                            <option value="owed_to_me">Owes Me</option>
                            <option value="owed_by_me">I Owe</option>
                        </select>
                    </div>
                    <Button size="sm" className="w-full shadow-none" onClick={handleAdd}>Save Entry</Button>
                </div>
            )}

            <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar max-h-64">
                 {debts.length === 0 && !isAdding ? (
                     <p className="text-xs text-gray-400 text-center italic py-4">No debts recorded. You're clean!</p>
                 ) : null}
                {debts.map(debt => (
                    <div key={debt.id} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg group transition-colors border border-transparent hover:border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className={`w-1.5 h-8 rounded-full ${debt.type === 'owed_to_me' ? 'bg-green-400' : 'bg-red-400'}`}></div>
                            <div>
                                <p className="font-semibold text-sm text-gray-800">{debt.person}</p>
                                <p className={`text-[10px] font-medium uppercase ${debt.type === 'owed_to_me' ? 'text-green-600' : 'text-red-600'}`}>
                                    {debt.type === 'owed_to_me' ? 'Incoming' : 'Outgoing'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-gray-700">{KESFormatter.format(debt.amount)}</span>
                             <button onClick={() => onDelete(debt.id)} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1 rounded transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
};

// --- CHAMA WIDGET ---
interface ChamaWidgetProps {
    chamas: Chama[];
    onAdd: (chama: Chama) => void;
}

export const ChamaWidget: React.FC<ChamaWidgetProps> = ({ chamas, onAdd }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [name, setName] = useState('');
    const [contribution, setContribution] = useState('');

    const handleAdd = () => {
        if (name && contribution) {
            onAdd({
                id: Date.now().toString(),
                name,
                myContribution: parseFloat(contribution),
                cycleTotal: 0
            });
            setIsAdding(false);
            setName('');
            setContribution('');
        }
    };

    return (
        <Card className="p-6 flex flex-col h-full border border-gray-100 shadow-lg shadow-gray-200/40 transition-shadow hover:shadow-xl hover:shadow-gray-200/50 bg-gradient-to-b from-white to-blue-50/30">
             <WidgetHeader 
                title="My Chamas" 
                icon={<Users size={20} />} 
                iconColorClass="bg-blue-50 text-blue-600"
                onAdd={() => setIsAdding(!isAdding)}
                isAdding={isAdding}
            />

            {isAdding && (
                <div className="mb-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm space-y-3 animate-in fade-in slide-in-from-top-2">
                    <InputField placeholder="Chama Name" value={name} onChange={e => setName(e.target.value)} autoFocus />
                    <InputField type="number" placeholder="My Contribution (KES)" value={contribution} onChange={e => setContribution(e.target.value)} />
                    <Button size="sm" className="w-full shadow-none" onClick={handleAdd}>Save Group</Button>
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 flex-1 overflow-y-auto pr-1 custom-scrollbar max-h-64">
                {chamas.length === 0 && !isAdding ? (
                    <div className="h-32 flex flex-col items-center justify-center text-center text-gray-400 border-2 border-dashed border-blue-100 rounded-xl bg-white/50">
                        <Users size={24} className="mb-2 opacity-50" />
                        <p className="text-xs">Join a Chama to track it here</p>
                    </div>
                ) : null}
                {chamas.map(chama => (
                    <div key={chama.id} className="bg-white p-4 rounded-xl shadow-sm border border-blue-100 hover:border-blue-300 transition-colors group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Users size={40} className="text-blue-600" />
                        </div>
                        <div className="relative z-10">
                            <p className="font-bold text-gray-800 text-lg leading-tight mb-1">{chama.name}</p>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-[10px] font-semibold uppercase text-blue-400 bg-blue-50 px-1.5 py-0.5 rounded">Contribution</span>
                            </div>
                            <p className="text-xl font-black text-blue-600 mt-1">{KESFormatter.format(chama.myContribution)}</p>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
};

// --- INFLATION MONITOR WIDGET ---
interface PriceWatchWidgetProps {
    transactions: Transaction[];
}

export const PriceWatchWidget: React.FC<PriceWatchWidgetProps> = ({ transactions }) => {
    const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
    
    // Dynamically calculate the most frequent merchants/categories
    const dynamicTerms = useMemo(() => {
        if (transactions.length === 0) return ['Fuel', 'Tokens', 'Airtime'];

        const frequency: Record<string, number> = {};
        transactions.forEach(t => {
            const key = t.merchant || t.category;
            if (key && key !== 'Unknown') {
                frequency[key] = (frequency[key] || 0) + 1;
            }
        });

        // Sort by frequency
        const topTerms = Object.entries(frequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([term]) => term);

        return topTerms.length > 0 ? topTerms : ['Fuel', 'Tokens', 'Airtime'];
    }, [transactions]);

    // Set initial default if null
    React.useEffect(() => {
        if (!selectedTerm && dynamicTerms.length > 0) {
            setSelectedTerm(dynamicTerms[0]);
        }
    }, [dynamicTerms, selectedTerm]);

    const watchTerm = selectedTerm || 'Fuel';

    const chartData = useMemo(() => {
        const filtered = transactions
            .filter(t => {
                const match = watchTerm.toLowerCase();
                return (t.description?.toLowerCase().includes(match) || t.merchant?.toLowerCase().includes(match) || t.category?.toLowerCase().includes(match));
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Limit to last 20 points for cleaner sparkline
        return filtered.map(t => ({
            date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            amount: t.amount
        })).slice(-20);
    }, [transactions, watchTerm]);

    // Calculate basic trend
    const trend = useMemo(() => {
        if (chartData.length < 2) return 'neutral';
        const first = chartData[0].amount;
        const last = chartData[chartData.length - 1].amount;
        return last > first ? 'up' : last < first ? 'down' : 'neutral';
    }, [chartData]);

    return (
        <Card className="p-6 flex flex-col h-full border border-gray-100 shadow-lg shadow-gray-200/40 transition-shadow hover:shadow-xl hover:shadow-gray-200/50">
             <WidgetHeader 
                title="Inflation Watch" 
                icon={<TrendingUp size={20} />} 
                iconColorClass="bg-red-50 text-red-600"
            />
            
            <div className="flex flex-wrap gap-2 mb-6">
                {dynamicTerms.map(term => (
                    <button 
                        key={term} 
                        onClick={() => setSelectedTerm(term)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all border ${
                            watchTerm === term 
                            ? 'bg-gray-800 text-white border-gray-800 shadow-md' 
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        {term}
                    </button>
                ))}
            </div>

            <div className="flex-1 min-h-[140px] w-full bg-gradient-to-b from-transparent to-red-50/50 rounded-xl relative overflow-hidden border border-gray-50">
                {chartData.length > 1 ? (
                    <>
                        <div className="absolute top-3 right-3 z-10">
                            {trend === 'up' && <span className="flex items-center gap-1 text-xs font-bold text-red-500 bg-white px-2 py-1 rounded-full shadow-sm border border-red-100"><ArrowUpRight size={12} /> Rising</span>}
                            {trend === 'down' && <span className="flex items-center gap-1 text-xs font-bold text-green-500 bg-white px-2 py-1 rounded-full shadow-sm border border-green-100"><ArrowDownLeft size={12} /> Falling</span>}
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <Tooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                    formatter={(value: number) => [KESFormatter.format(value), 'Paid']}
                                    labelStyle={{ fontSize: '10px', color: '#9CA3AF', marginBottom: '4px' }}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="amount" 
                                    stroke="#EF4444" 
                                    strokeWidth={2} 
                                    fillOpacity={1} 
                                    fill="url(#colorPrice)" 
                                    animationDuration={1000}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
                        <TrendingUp size={24} className="opacity-20" />
                        <p className="text-xs text-center max-w-[150px]">Select a tag above to see price trends.</p>
                    </div>
                )}
            </div>
            <p className="text-[10px] text-gray-400 mt-3 text-center uppercase tracking-widest">Transaction Cost Trend</p>
        </Card>
    );
}
