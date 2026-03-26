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
                        <AtsBreadcrumb items={[{ label: "Assistant" }]} className="mb-0" />
                        <Button variant="ghost" size="sm" onClick={handleTestBypass} className="h-8 text-[10px] text-slate-400 border border-slate-100 italic">
                            DEBUG: Test UI
                        </Button>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleNewChat} className="rounded-xl">
                        <MessageSquarePlus className="w-4 h-4 mr-2" />
                        New Chat
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
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4">
                                <Sparkles className="text-indigo-600" />
                            </div>
                            <h3 className="font-bold text-lg">AI Assistant Ready</h3>
                            <p className="text-sm text-slate-400">Type a message to start.</p>
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                                <div className={cn("max-w-[80%] p-3 rounded-xl text-sm", msg.role === "user" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-800 shadow-sm")}>
                                    <div className="whitespace-pre-wrap font-sans text-xs">
                                        {typeof msg.content === 'string' ? msg.content : "[Non-string content detected]"}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t bg-white">
                    <div className="max-w-3xl mx-auto flex gap-2">
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
    );
}
