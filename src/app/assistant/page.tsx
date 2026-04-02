"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
    Send, 
    MessageSquarePlus, 
    Copy, 
    Bot, 
    User,
    Sparkles, 
    Loader2,
    History,
    Plus,
    Search,
    Clock,
    RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AtsBreadcrumb } from "@/components/ats-breadcrumb";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AssistantSidebar } from "@/components/assistant/AssistantSidebar";
import { 
    deleteAssistantSession, 
    getAssistantMessageMetadata,
    getAssistantMessagesByIds,
    getAssistantMessages,
    saveAssistantSession 
} from "@/app/actions/assistant-actions";

interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    isSystem?: boolean; // New flag
    timestamp: Date;
}

function generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function AssistantPage() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [loadStatus, setLoadStatus] = useState<string>("");
    const [thinkingStatus, setThinkingStatus] = useState<string>("Thinking...");
    const [sessionId, setSessionId] = useState<string>("");
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // EMERGENCY: NO AUTOMATIC FETCH ON MOUNT -> RE-ENABLING CAREFULLY
    useEffect(() => {
        const savedSessionId = localStorage.getItem("ats_chat_session_id");
        if (savedSessionId) {
            setSessionId(savedSessionId);
            console.log(">>> [DEBUG] Found saved session:", savedSessionId);
            // Wait 1 second before auto-fetching to ensure page is fully ready
            const timer = setTimeout(() => {
                handleSelectSession(savedSessionId);
            }, 1000);
            return () => clearTimeout(timer);
        } else {
            const newId = generateSessionId();
            setSessionId(newId);
            localStorage.setItem("ats_chat_session_id", newId);
        }
    }, []);

    const handleTestBypass = async () => {
        console.log(">>> [DEBUG] Testing UI with Dummy Data...");
        setIsHistoryLoading(true);
        try {
            const res = await getAssistantMessages("test_debug");
            if (res.success && res.data) {
                setMessages(res.data as ChatMessage[]);
            }
        } finally {
            setIsHistoryLoading(false);
        }
    };

    const handleSelectSession = async (sid: string) => {
        if (!sid || isHistoryLoading) return;
        console.log(">>> [DEBUG] Selecting Session:", sid);
        setSessionId(sid);
        localStorage.setItem("ats_chat_session_id", sid);
        setIsHistoryLoading(true);
        setLoadStatus("Checking history...");
        setMessages([]); 

        try {
            // STEP 1: Fast metadata fetch
            const metaRes = await getAssistantMessageMetadata(sid, 15);
            if (!metaRes.success) {
                console.error("Meta Fetch Error:", metaRes.error);
                setLoadStatus("Error loading history metadata");
                setIsHistoryLoading(false);
                return;
            }

            const messageIds = metaRes.data as string[];
            console.log(`>>> [DEBUG] Metadata loaded: ${messageIds.length} IDs`);
            if (messageIds.length === 0) {
                setLoadStatus("");
                setIsHistoryLoading(false);
                return;
            }

            setLoadStatus(`Loading ${messageIds.length} messages...`);

            // STEP 2: Content fetch for these specific IDs
            const contentRes = await getAssistantMessagesByIds(messageIds);
            if (contentRes.success && contentRes.data) {
                console.log(`>>> [DEBUG] Content loaded: ${contentRes.data.length} messages`);
                setMessages(contentRes.data as ChatMessage[]);
                setLoadStatus("");
            } else {
                setLoadStatus("Failed to load message content");
            }
        } catch (err) {
            console.error(">>> [DEBUG] Manual fetch error:", err);
            setLoadStatus("Critical error during load");
        } finally {
            setIsHistoryLoading(false);
        }
    };

    const handleNewChat = () => {
        const newId = generateSessionId();
        setMessages([]);
        setSessionId(newId);
        setInput("");
        localStorage.setItem("ats_chat_session_id", newId);
        textareaRef.current?.focus();
    };

    const handleSend = async (customText?: string) => {
        const textToSend = customText || input.trim();
        if (!textToSend || isLoading) return;

        const userMsg: ChatMessage = {
            id: `msg_${Date.now()}`,
            role: "user",
            content: textToSend,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);
        setThinkingStatus("Thinking...");

        // Progressive status updates
        const timer1 = setTimeout(() => setThinkingStatus("Analyzing candidate profiles..."), 15000);
        const timer2 = setTimeout(() => setThinkingStatus("Comparing and ranking matches..."), 45000);
        const timer3 = setTimeout(() => setThinkingStatus("Almost there, finalizing the answer..."), 80000);
        const timer4 = setTimeout(() => setThinkingStatus("Detailed reasoning takes time, still working..."), 150000); // 2.5m
        const timer5 = setTimeout(() => setThinkingStatus("Synthesizing complex candidate data..."), 300000); // 5m

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: textToSend, sessionId }),
            });

            const data = await res.json();
            const assistantMsg: ChatMessage = {
                id: `msg_${Date.now()}_a`,
                role: "assistant",
                content: data.answer || "ไม่มีคำตอบจากระบบ",
                isSystem: false, // Default for answer
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
            
            // Background save session mapping
            saveAssistantSession(sessionId, textToSend.slice(0, 50))
                .then(() => setRefreshTrigger(v => v + 1));
        } catch (error: any) {
            let errorMsg = error.message;
            if (errorMsg.includes("aborted")) {
                errorMsg = "The task was extremely complex and reached the 10-minute limit. Try asking for a smaller subset of candidates.";
            }
            setMessages((prev) => [...prev, {
                id: `msg_err_${Date.now()}`,
                role: "assistant",
                content: "Error: " + errorMsg,
                timestamp: new Date()
            }]);
        } finally {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
            clearTimeout(timer4);
            clearTimeout(timer5);
            setIsLoading(false);
        }
    };

    return (
        <div className="flex h-screen bg-slate-100 overflow-hidden">
            <AssistantSidebar 
                onSelectSession={handleSelectSession}
                activeSessionId={sessionId}
                onNewChat={handleNewChat}
                refreshTrigger={refreshTrigger}
            />

            <div className="flex-1 flex flex-col h-full bg-white relative">
                <div className="p-4 border-b flex justify-between items-center bg-white z-20">
                    <div className="flex items-center gap-4">
                        <AtsBreadcrumb items={[{ label: "AI Primary Search" }]} className="mb-0" />
                        <Button variant="ghost" size="sm" onClick={handleTestBypass} className="h-8 text-[10px] text-slate-400 border border-slate-100 italic">
                            DEBUG: Test UI
                        </Button>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleNewChat} className="rounded-xl">
                        <Plus className="w-4 h-4 mr-2" />
                        New Search
                    </Button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {isHistoryLoading && (
                        <div className="flex flex-col items-center justify-center h-20 text-slate-400 gap-2">
                            <RefreshCw className="w-5 h-5 animate-spin" />
                            <span className="text-[10px] font-medium animate-pulse">{loadStatus || "Loading..."}</span>
                        </div>
                    )}
                    
                    {!isHistoryLoading && messages.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-4xl mx-auto w-full">
                            <div className="mb-8 text-center">
                                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-200">
                                    <Sparkles className="text-white w-8 h-8" />
                                </div>
                                <h1 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">AI Primary Search</h1>
                                <p className="text-slate-500 text-lg font-medium">Smart candidate discovery & pipeline analysis</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-12">
                                {/* Category 1: Discovery */}
                                <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                                            <Search className="w-4 h-4 text-blue-600" />
                                        </div>
                                        <h3 className="font-bold text-slate-800">Smart Discovery</h3>
                                    </div>
                                    <div className="space-y-2">
                                        {[
                                            "Find Java Developers in Bangkok with 5+ years experience",
                                            "Search for candidates who worked at Google or Agoda"
                                        ].map(query => (
                                            <button 
                                                key={query}
                                                onClick={() => setInput(query)}
                                                className="w-full text-left p-3 text-[12px] bg-white border border-slate-200 rounded-xl hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm font-medium"
                                            >
                                                {query}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Category 2: Insights */}
                                <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center">
                                            <Clock className="w-4 h-4 text-emerald-600" />
                                        </div>
                                        <h3 className="font-bold text-slate-800">Insights & Stats</h3>
                                    </div>
                                    <div className="space-y-2">
                                        {[
                                            "Who has the highest ranking in the Project Manager job group?",
                                            "Summarize candidate nationalities for the Sales position"
                                        ].map(query => (
                                            <button 
                                                key={query}
                                                onClick={() => setInput(query)}
                                                className="w-full text-left p-3 text-[12px] bg-white border border-slate-200 rounded-xl hover:border-emerald-400 hover:text-emerald-600 transition-all shadow-sm font-medium"
                                            >
                                                {query}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Category 3: Management */}
                                <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center">
                                            <Bot className="w-4 h-4 text-amber-600" />
                                        </div>
                                        <h3 className="font-bold text-slate-800">Management</h3>
                                    </div>
                                    <div className="space-y-2">
                                        {[
                                            "Why is Sumeth blacklisted? Show me the reason",
                                            "Create a new Job Requisition for IT: 'Cloud Architect'"
                                        ].map(query => (
                                            <button 
                                                key={query}
                                                onClick={() => setInput(query)}
                                                className="w-full text-left p-3 text-[12px] bg-white border border-slate-200 rounded-xl hover:border-amber-500 hover:text-amber-700 transition-all shadow-sm font-medium"
                                            >
                                                {query}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Category 4: Research */}
                                <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center">
                                            <History className="w-4 h-4 text-indigo-600" />
                                        </div>
                                        <h3 className="font-bold text-slate-800">External Research</h3>
                                    </div>
                                    <div className="space-y-2">
                                        {[
                                            "Latest AI trends in Recruitment for 2024",
                                            "Find new candidate profiles for 'Machine Learning Engineer' online"
                                        ].map(query => (
                                            <button 
                                                key={query}
                                                onClick={() => setInput(query)}
                                                className="w-full text-left p-3 text-[12px] bg-white border border-slate-200 rounded-xl hover:border-indigo-400 hover:text-indigo-600 transition-all shadow-sm font-medium"
                                            >
                                                {query}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <p className="text-[11px] text-slate-400 font-medium bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
                                💡 Tip: The more specific your query, the better the results. Data is fetched from internal DB and Real-time Search.
                            </p>
                        </div>
                    ) : (
                        messages.map((msg) => {
                            if (msg.isSystem) {
                                // Render technical logs as a subtle, minimal element
                                return (
                                    <div key={msg.id} className="flex justify-start px-8">
                                        <div className="text-[9px] text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 flex items-center gap-2 italic">
                                            <Bot size={10} className="text-slate-300" />
                                            {msg.content.length > 60 ? msg.content.slice(0, 60) + "..." : msg.content}
                                        </div>
                                    </div>
                                );
                            }
                            
                            return (
                                <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                                    <div className={cn("max-w-[80%] p-3 rounded-xl text-sm", msg.role === "user" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-800 shadow-sm")}>
                                        <div className="whitespace-pre-wrap font-sans text-xs">
                                            {typeof msg.content === 'string' ? msg.content : "[Non-string content detected]"}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t bg-white">
                    <div className="max-w-3xl mx-auto flex flex-col gap-2">
                        {/* Tip above input */}
                        <div className="flex items-center gap-2 px-1 mb-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                            <p className="text-[10px] text-slate-400 font-medium italic">
                                Focused on Internal DB. Add <span className="text-indigo-600 font-bold">"Search from Internet"</span> to broaden your discovery.
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <Textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
                            disabled={isLoading}
                            placeholder="Message..."
                            className="bg-slate-50 border-slate-200 rounded-xl min-h-[44px] max-h-[120px]"
                            rows={1}
                        />
                        <Button onClick={() => handleSend()} disabled={!input.trim() || isLoading} className="rounded-xl h-11 px-6 relative overflow-hidden group">
                            {isLoading ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="animate-spin w-4 h-4" />
                                    <span className="text-[10px] font-medium animate-pulse whitespace-nowrap">{thinkingStatus}</span>
                                </div>
                            ) : (
                                <Send className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    </div>
);
}
