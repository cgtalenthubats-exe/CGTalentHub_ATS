"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Loader2, Sparkles, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export function ChatWidget() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string>('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load state from localStorage on mount (share with assistant page)
    useEffect(() => {
        const savedMessages = localStorage.getItem("ats_chat_messages");
        const savedSessionId = localStorage.getItem("ats_chat_session_id");

        if (savedMessages) {
            try {
                const parsed = JSON.parse(savedMessages).map((m: any) => ({
                    ...m,
                    timestamp: new Date(m.timestamp)
                }));
                setMessages(parsed);
            } catch (e) {
                console.error("Failed to parse saved messages", e);
            }
        }

        if (savedSessionId) {
            setSessionId(savedSessionId);
        }
    }, [isOpen]); // Reload when opened to catch updates from assistant page

    // Save messages to localStorage whenever they change
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem("ats_chat_messages", JSON.stringify(messages));
        }
    }, [messages]);

    // Hooks MUST be called before any conditional returns
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading, isOpen]);

    // Now it's safe to return null if we are on the assistant page
    if (pathname === '/assistant') return null;

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || loading) return;

        const userMsg: Message = { 
            id: `msg_${Date.now()}`,
            role: 'user', 
            content: text,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: text, 
                    sessionId: sessionId || undefined 
                }),
            });
            const data = await res.json();
            
            const assistantMsg: Message = {
                id: `msg_${Date.now()}_a`,
                role: 'assistant',
                content: data.answer || 'ไม่มีคำตอบจากระบบ',
                timestamp: new Date()
            };
            
            setMessages(prev => [...prev, assistantMsg]);
        } catch {
            const errorMsg: Message = {
                id: `msg_${Date.now()}_err`,
                role: 'assistant',
                content: '❌ เกิดข้อผิดพลาด ลองใหม่อีกครั้ง',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
            {/* Chat Panel */}
            {isOpen && (
                <div className="w-80 rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/50 overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 fade-in duration-300"
                    style={{ height: '440px' }}>

                    {/* Header */}
                    <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                <Bot className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <p className="text-white text-sm font-bold leading-none">AI Power Search</p>
                                <p className="text-violet-200 text-[10px] mt-0.5">RAG · n8n · Supabase</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <Link href="/admin/n8n" onClick={() => setIsOpen(false)}
                                className="text-white/60 hover:text-white transition-colors p-1 rounded" title="Settings">
                                <Settings className="w-3.5 h-3.5" />
                            </Link>
                            <button onClick={() => setIsOpen(false)} className="text-white/60 hover:text-white transition-colors p-1">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-slate-400">
                                <Sparkles className="w-8 h-8 text-violet-300" />
                                <div>
                                    <p className="text-xs font-semibold text-slate-600">สวัสดีครับ! 👋</p>
                                    <p className="text-[11px] mt-0.5">ถามอะไรก็ได้เกี่ยวกับ Candidates, JR, หรือ Pipeline</p>
                                </div>
                            </div>
                        )}

                        {messages.map((msg, i) => (
                            <div key={msg.id || `msg_legacy_${i}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${msg.role === 'user'
                                        ? 'bg-violet-600 text-white rounded-br-sm'
                                        : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm shadow-sm'
                                    }`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="border-t bg-white p-3 flex gap-2 shrink-0">
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="พิมพ์คำถาม..."
                            disabled={loading}
                            className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-violet-300 disabled:opacity-50"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={loading || !input.trim()}
                            className="w-8 h-8 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 flex items-center justify-center shrink-0 transition-colors"
                        >
                            <Send className="w-3.5 h-3.5 text-white" />
                        </button>
                    </div>
                </div>
            )}

            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 ${isOpen
                        ? 'bg-slate-700 hover:bg-slate-800'
                        : 'bg-gradient-to-br from-violet-600 to-indigo-600 hover:scale-110 hover:shadow-violet-300/50 hover:from-violet-500 hover:to-indigo-500'
                    }`}
                title="AI Power Search"
            >
                {isOpen ? <X className="w-5 h-5 text-white" /> : <Bot className="w-6 h-6 text-white" />}
                {!isOpen && <span className="absolute w-14 h-14 rounded-full bg-violet-400 opacity-30 animate-ping" />}
            </button>
        </div>
    );
}
