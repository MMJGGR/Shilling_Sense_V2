
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Sparkles, TrendingUp, AlertCircle, PieChart } from 'lucide-react';
import Button from './ui/Button';
import { AppContextData } from '../types';
import { createFinancialChatSession } from '../services/geminiService';
import { Chat, GenerateContentResponse } from '@google/genai';

interface ChatAssistantProps {
  contextData: AppContextData;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  isStreaming?: boolean;
}

const QUICK_PROMPTS = [
    { label: "Spending Summary", icon: <PieChart size={12} />, prompt: "Give me a summary of my spending this month by category." },
    { label: "Debt Check", icon: <AlertCircle size={12} />, prompt: "What is my current net debt position?" },
    { label: "Recent Trends", icon: <TrendingUp size={12} />, prompt: "How does my spending this week compare to last week?" },
];

const ChatAssistant: React.FC<ChatAssistantProps> = ({ contextData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'model', text: "Habari! I'm your Pocket CFO. Ask me anything about your spending, debts, or Chama contributions." }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // Reset chat session when context changes significantly
  useEffect(() => {
    chatSessionRef.current = null; 
  }, [contextData.transactions.length, contextData.debts.length]);

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim()) return;
    
    const userMessage: Message = { id: Date.now().toString(), role: 'user', text: textToSend };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
        // Initialize chat if not ready
        if (!chatSessionRef.current) {
            chatSessionRef.current = createFinancialChatSession(contextData);
        }

        const modelMessageId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, { id: modelMessageId, role: 'model', text: '', isStreaming: true }]);

        const result = await chatSessionRef.current.sendMessageStream({ message: userMessage.text });
        
        let fullText = '';
        for await (const chunk of result) {
            const c = chunk as GenerateContentResponse;
            const text = c.text || '';
            fullText += text;
            
            setMessages(prev => prev.map(msg => 
                msg.id === modelMessageId 
                ? { ...msg, text: fullText } 
                : msg
            ));
            scrollToBottom();
        }
        
        setMessages(prev => prev.map(msg => 
            msg.id === modelMessageId 
            ? { ...msg, isStreaming: false } 
            : msg
        ));

    } catch (error) {
        console.error("Chat error", error);
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "Sorry, I hit a snag connecting to the server. Please try again." }]);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <>
        {/* Floating Trigger Button */}
        {!isOpen && (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 h-14 w-14 bg-brand-green text-white rounded-full shadow-xl flex items-center justify-center hover:bg-brand-green-600 transition-all transform hover:scale-105 z-50 group"
                aria-label="Open Pocket CFO"
            >
                <MessageSquare size={24} />
                <div className="absolute -top-10 right-0 bg-brand-gray-900 text-white text-xs px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Ask Pocket CFO
                </div>
            </button>
        )}

        {/* Chat Interface Window */}
        {isOpen && (
            <div className="fixed bottom-6 right-6 w-full sm:w-96 h-[600px] max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-brand-gray-200 overflow-hidden animate-in slide-in-from-bottom-10 fade-in">
                
                {/* Header */}
                <div className="bg-brand-green p-4 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2 text-white">
                        <Sparkles size={18} />
                        <h3 className="font-bold">Pocket CFO</h3>
                        <span className="bg-yellow-400 text-brand-green font-bold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">Premium</span>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-brand-gray-50">
                    {messages.map((msg) => (
                        <div 
                            key={msg.id} 
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div 
                                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                                    msg.role === 'user' 
                                    ? 'bg-brand-green text-white rounded-br-none' 
                                    : 'bg-white text-brand-gray-800 rounded-bl-none border border-brand-gray-200'
                                }`}
                            >
                                {msg.text}
                                {msg.isStreaming && <span className="inline-block w-1.5 h-4 ml-1 bg-brand-green-400 animate-pulse align-middle"></span>}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Quick Prompts & Input Area */}
                <div className="p-3 bg-white border-t border-brand-gray-200 flex-shrink-0">
                    {messages.length < 3 && (
                        <div className="flex gap-2 overflow-x-auto pb-3 custom-scrollbar">
                            {QUICK_PROMPTS.map((qp, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleSend(qp.prompt)}
                                    className="flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 bg-brand-green-50 hover:bg-brand-green-100 text-brand-green-700 rounded-full text-xs font-medium transition-colors border border-brand-green-200"
                                >
                                    {qp.icon} {qp.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <form 
                        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                        className="flex items-center gap-2"
                    >
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask about debts, chamas, spending..."
                            className="flex-1 bg-brand-gray-50 border-0 rounded-full px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-green focus:bg-white transition-all"
                            autoFocus
                        />
                        <Button 
                            type="submit" 
                            disabled={!input.trim() || isLoading} 
                            className="rounded-full w-10 h-10 !p-0 flex items-center justify-center flex-shrink-0"
                        >
                            <Send size={18} className={isLoading ? 'opacity-50' : ''} />
                        </Button>
                    </form>
                </div>
            </div>
        )}
    </>
  );
};

export default ChatAssistant;
