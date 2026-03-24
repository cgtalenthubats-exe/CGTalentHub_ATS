"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Send,
    Loader2,
    Bot,
    User,
    Sparkles,
    RotateCcw,
    MessageSquarePlus,
    Copy,
    Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AtsBreadcrumb } from "@/components/ats-breadcrumb";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
}

// Generate a unique session ID
function generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function AssistantPage() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string>("");
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Load initial state from localStorage on client side
    useEffect(() => {
        const savedMessages = localStorage.getItem("ats_chat_messages");
        const savedSessionId = localStorage.getItem("ats_chat_session_id");

        if (savedMessages) {
            try {
                // Parse dates correctly
                const parsed = JSON.parse(savedMessages).map((m: any) => ({
                    ...m,
                    timestamp: new Date(m.timestamp),
                }));
                setMessages(parsed);
            } catch (e) {
                console.error("Failed to parse saved messages", e);
            }
        }

        if (savedSessionId) {
            setSessionId(savedSessionId);
        } else {
            const newId = generateSessionId();
            setSessionId(newId);
            localStorage.setItem("ats_chat_session_id", newId);
        }
    }, []);

    // Save messages to localStorage whenever they change
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem("ats_chat_messages", JSON.stringify(messages));
        }
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
        }
    }, [input]);

    const handleNewChat = () => {
        const newId = generateSessionId();
        setMessages([]);
        setSessionId(newId);
        setInput("");
        localStorage.removeItem("ats_chat_messages");
        localStorage.setItem("ats_chat_session_id", newId);
        textareaRef.current?.focus();
    };

    const handleCopy = (content: string, id: string) => {
        navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed || isLoading) return;

        const userMsg: ChatMessage = {
            id: `msg_${Date.now()}`,
            role: "user",
            content: trimmed,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
        }

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: trimmed,
                    sessionId,
                }),
            });

            const data = await res.json();

            const assistantMsg: ChatMessage = {
                id: `msg_${Date.now()}_a`,
                role: "assistant",
                content: data.answer || "ไม่มีคำตอบจากระบบ",
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, assistantMsg]);
        } catch (error: any) {
            const errorMsg: ChatMessage = {
                id: `msg_${Date.now()}_err`,
                role: "assistant",
                content: `❌ เกิดข้อผิดพลาด: ${error.message}`,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50/50">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-md border-b px-6 py-3 flex justify-between items-center sticky top-0 z-10">
                <AtsBreadcrumb items={[{ label: "AI Assistant" }]} />
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-2 py-1 rounded">
                        {sessionId.slice(0, 20)}...
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNewChat}
                        className="h-8 gap-2 text-xs font-bold rounded-lg"
                    >
                        <MessageSquarePlus className="w-3.5 h-3.5" />
                        New Chat
                    </Button>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-4 py-6">
                    {messages.length === 0 ? (
                        <EmptyState onSuggestionClick={(text) => {
                            setInput(text);
                            // Auto-send after a tick
                            setTimeout(() => {
                                const userMsg: ChatMessage = {
                                    id: `msg_${Date.now()}`,
                                    role: "user",
                                    content: text,
                                    timestamp: new Date(),
                                };
                                setMessages((prev) => [...prev, userMsg]);
                                setIsLoading(true);
                                fetch("/api/chat", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ message: text, sessionId }),
                                })
                                    .then((res) => res.json())
                                    .then((data) => {
                                        setMessages((prev) => [
                                            ...prev,
                                            {
                                                id: `msg_${Date.now()}_a`,
                                                role: "assistant",
                                                content: data.answer || "ไม่มีคำตอบจากระบบ",
                                                timestamp: new Date(),
                                            },
                                        ]);
                                    })
                                    .catch((err) => {
                                        setMessages((prev) => [
                                            ...prev,
                                            {
                                                id: `msg_${Date.now()}_err`,
                                                role: "assistant",
                                                content: `❌ เกิดข้อผิดพลาด: ${err.message}`,
                                                timestamp: new Date(),
                                            },
                                        ]);
                                    })
                                    .finally(() => {
                                        setIsLoading(false);
                                        setInput("");
                                    });
                            }, 50);
                        }} />
                    ) : (
                        <div className="space-y-6">
                            <AnimatePresence mode="popLayout">
                                {messages.map((msg, i) => (
                                    <motion.div
                                        key={msg.id || `msg_legacy_${i}`}
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className={cn(
                                            "flex gap-3",
                                            msg.role === "user"
                                                ? "justify-end"
                                                : "justify-start"
                                        )}
                                    >
                                        {msg.role === "assistant" && (
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20 mt-1">
                                                <Bot className="w-4 h-4 text-white" />
                                            </div>
                                        )}

                                        <div
                                            className={cn(
                                                "relative group max-w-[85%] rounded-2xl px-4 py-3",
                                                msg.role === "user"
                                                    ? "bg-indigo-600 text-white rounded-br-md"
                                                    : "bg-white border border-slate-200 text-slate-800 rounded-bl-md shadow-sm"
                                            )}
                                        >
                                            {msg.role === "assistant" ? (
                                                <div className="prose prose-sm prose-slate max-w-none text-sm leading-relaxed [&_p]:mb-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-indigo-700 [&_code]:text-xs [&_pre]:bg-slate-900 [&_pre]:text-slate-100 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:my-2 [&_strong]:text-slate-900 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_table]:text-xs [&_th]:bg-slate-100 [&_th]:border [&_th]:border-slate-300 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-1.5 [&_tr:nth-child(even)]:bg-slate-50">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {msg.content}
                                                    </ReactMarkdown>
                                                </div>
                                            ) : (
                                                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                                    {msg.content}
                                                </p>
                                            )}

                                            {/* Copy button */}
                                            <button
                                                onClick={() =>
                                                    handleCopy(msg.content, msg.id)
                                                }
                                                className={cn(
                                                    "absolute -bottom-6 right-2 opacity-0 group-hover:opacity-100 transition-opacity",
                                                    "text-[10px] flex items-center gap-1 text-slate-400 hover:text-slate-600"
                                                )}
                                            >
                                                {copiedId === msg.id ? (
                                                    <>
                                                        <Check className="w-3 h-3" />{" "}
                                                        Copied
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="w-3 h-3" />{" "}
                                                        Copy
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        {msg.role === "user" && (
                                            <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center shrink-0 mt-1">
                                                <User className="w-4 h-4 text-slate-600" />
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {/* Typing Indicator */}
                            {isLoading && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex gap-3 justify-start"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20 mt-1">
                                        <Bot className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-5 py-4 shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="flex gap-1">
                                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms]" />
                                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]" />
                                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms]" />
                                            </div>
                                            <span className="text-xs text-slate-400 ml-2">
                                                กำลังคิด...
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="border-t bg-white/80 backdrop-blur-md px-4 py-4">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-end gap-3 bg-white border border-slate-200 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-300 transition-all p-2">
                        <Textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="พิมพ์ข้อความ... (Enter ส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"
                            disabled={isLoading}
                            className="flex-1 min-h-[44px] max-h-[160px] resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm bg-transparent placeholder:text-slate-400"
                            rows={1}
                        />
                        <Button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            size="icon"
                            className={cn(
                                "h-10 w-10 rounded-xl shrink-0 transition-all",
                                input.trim() && !isLoading
                                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20"
                                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                            )}
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        </Button>
                    </div>
                    <p className="text-[10px] text-slate-400 text-center mt-2 font-medium">
                        AI Assistant powered by CG Talent Hub • Vector Search enabled
                    </p>
                </div>
            </div>
        </div>
    );
}

// --- Empty State ---
function EmptyState({ onSuggestionClick }: { onSuggestionClick?: (text: string) => void }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center h-[60vh] text-center"
        >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center mb-6 shadow-2xl shadow-indigo-500/30">
                <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
                CG Talent Hub Assistant
            </h2>
            <p className="text-sm text-slate-500 max-w-md leading-relaxed mb-8">
                ค้นหา Candidate ด้วย AI ถามเป็นภาษาธรรมชาติได้เลย
                ระบบจะค้นหาจาก Vector Database ให้อัตโนมัติ
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
                {[
                    "หา GM ด้านโรงแรมในไทย",
                    "ค้นหา CFO ที่เคยทำบริษัท SET100",
                    "ใครเหมาะกับตำแหน่ง VP Marketing ในธุรกิจ F&B",
                    "หาคนที่มีประสบการณ์ด้าน Digital Transformation",
                ].map((suggestion, idx) => (
                    <button
                        key={idx}
                        onClick={() => onSuggestionClick?.(suggestion)}
                        className="text-left px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-xs text-slate-600 hover:text-indigo-700 font-medium shadow-sm hover:shadow-md"
                    >
                        <span className="opacity-50 mr-1">💬</span> {suggestion}
                    </button>
                ))}
            </div>
        </motion.div>
    );
}

