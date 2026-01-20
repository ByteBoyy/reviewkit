import React, { useState, useRef, useEffect } from 'react';
import { Review } from '../types';
import { createReviewChat } from '../services/geminiService';
import { GenerateContentResponse } from '@google/genai';
import Logo from './Logo';

interface Message {
  role: 'user' | 'ai';
  text: string;
}

interface ReviewChatProps {
  reviews: Review[];
  usage: { current: number; limit: number };
  onChatSent?: () => void;
  onUpgrade?: () => void;
}

const CHAT_SUGGESTIONS = [
  "What are the top 3 complaints?",
  "Summarize the positive feedback",
  "Is our pricing mentioned often?",
  "How is our customer service?",
  "What should we improve first?"
];

const ReviewChat: React.FC<ReviewChatProps> = ({ reviews, usage, onChatSent, onUpgrade }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: `I've analyzed all ${reviews.length} reviews. What would you like to know about the customer feedback?` }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isLimitReached = usage.current >= usage.limit;

  useEffect(() => {
    chatRef.current = createReviewChat(reviews);
  }, [reviews]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (customMessage?: string) => {
    const userMessage = customMessage || input.trim();
    if (!userMessage || isTyping || isLimitReached) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsTyping(true);

    try {
      if (!chatRef.current) chatRef.current = createReviewChat(reviews);
      
      const stream = await chatRef.current.sendMessageStream({ message: userMessage });
      let fullResponse = '';
      
      setMessages(prev => [...prev, { role: 'ai', text: '' }]);

      for await (const chunk of stream) {
        const chunkText = (chunk as GenerateContentResponse).text;
        fullResponse += chunkText;
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { role: 'ai', text: fullResponse };
          return newMessages;
        });
      }

      onChatSent?.();
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: 'I apologize, but I encountered an error processing that request.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[600px] animate-in slide-in-from-right-4 duration-500">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-100 p-2 shadow-sm text-brand-600">
             <Logo />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Intelligence Assistant</h4>
            <p className="text-[10px] text-slate-500 font-bold uppercase">Daily Limit: {usage.current}/{usage.limit}</p>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
              msg.role === 'user' 
                ? 'bg-brand-600 text-white font-medium rounded-tr-none' 
                : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none leading-relaxed'
            }`}>
              {msg.text || (idx === messages.length - 1 && isTyping && <span className="animate-pulse">...</span>)}
            </div>
          </div>
        ))}
        {isLimitReached && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-center">
            <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-2">Daily Intelligence Limit Reached</p>
            <button onClick={onUpgrade} className="text-[10px] font-black text-brand-600 uppercase tracking-widest hover:underline">Upgrade Plan for Unlimited Access</button>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-100 bg-white space-y-4">
        {!isLimitReached && !isTyping && messages.length < 5 && (
          <div className="flex flex-wrap gap-2">
            {CHAT_SUGGESTIONS.map(s => (
              <button 
                key={s}
                onClick={() => handleSend(s)}
                className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200 transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLimitReached}
            placeholder={isLimitReached ? "Daily limit reached..." : "Ask a question..."}
            className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-brand-600 outline-none transition-all font-medium disabled:opacity-50"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isTyping || isLimitReached}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-brand-600 text-white rounded-lg flex items-center justify-center hover:bg-brand-700 disabled:bg-slate-300 transition-all shadow-md shadow-brand-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ReviewChat;