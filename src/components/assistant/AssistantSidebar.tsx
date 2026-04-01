"use client";

import React, { useEffect, useState } from "react";
import { getAssistantSessions, deleteAssistantSession } from "@/app/actions/assistant-actions";
import { 
    Loader2, 
    MessageSquare, 
    Trash2, 
    Clock, 
    Plus,
    Search,
    MessageCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AssistantSidebarProps {
    onSelectSession: (sessionId: string) => void;
    activeSessionId?: string | null;
    onNewChat: () => void;
    refreshTrigger?: number;
}

export function AssistantSidebar({ 
    onSelectSession, 
    activeSessionId, 
    onNewChat,
    refreshTrigger 
}: AssistantSidebarProps) {
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const res = await getAssistantSessions();
            if (res && res.success && res.data) {
                setSessions(res.data);
            } else {
                setSessions([]);
            }
        } catch (e) {
            console.error("fetchSessions Error:", e);
            setSessions([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, [refreshTrigger]);

    const handleDelete = async (sessionId: string) => {
        const res = await deleteAssistantSession(sessionId);
        if (res.success) {
            setSessions(prev => prev.filter(s => s.session_id !== sessionId));
            if (activeSessionId === sessionId) {
                onNewChat();
            }
        }
    };

    const filteredSessions = sessions.filter(s => 
        (s.title || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="w-72 h-full flex flex-col bg-white border-r border-slate-200">
            {/* Sidebar Header */}
            <div className="p-4 border-b space-y-3 bg-slate-50/50">
                <Button 
                    onClick={onNewChat}
                    className="w-full justify-start gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-500/10 h-10 font-bold"
                >
                    <Plus className="w-4 h-4" />
                    New Search
                </Button>

                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input 
                        type="text"
                        placeholder="Search conversations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-300 transition-all font-medium"
                    />
                </div>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto p-2">
                <div className="space-y-1">
                    <div className="px-2 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        Search History
                    </div>
                    
                    {loading && sessions.length === 0 ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="animate-spin w-5 h-5 text-indigo-400" />
                        </div>
                    ) : filteredSessions.length === 0 ? (
                        <div className="text-center p-6 text-[11px] text-slate-400 font-medium">
                            {searchQuery ? "No sessions found" : "No chat history"}
                        </div>
                    ) : (
                        filteredSessions.map((session) => (
                            <div
                                key={session.session_id}
                                className={cn(
                                    "group relative flex items-center p-2.5 rounded-xl cursor-pointer transition-all border border-transparent",
                                    activeSessionId === session.session_id 
                                        ? "bg-indigo-50/80 border-indigo-100 text-indigo-700" 
                                        : "text-slate-600 hover:bg-slate-50 hover:border-slate-100"
                                )}
                                onClick={() => onSelectSession(session.session_id)}
                            >
                                <MessageCircle className={cn(
                                    "w-4 h-4 shrink-0 mr-3",
                                    activeSessionId === session.session_id ? "text-indigo-500" : "text-slate-400"
                                )} />
                                
                                <div className="flex-1 min-w-0 pr-6">
                                    <div className="text-[12px] font-bold truncate leading-tight mb-0.5">
                                        {session.title || "New Search"}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-medium truncate">
                                        {session.created_at ? new Date(session.created_at).toLocaleDateString() : "Unknown Date"}
                                    </div>
                                </div>

                                <button 
                                    className="absolute right-2 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg transition-all text-slate-400"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm("Delete this session?")) {
                                            handleDelete(session.session_id);
                                        }
                                    }}
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Sidebar Footer */}
            <div className="p-4 border-t bg-slate-50/50">
                <div className="flex items-center gap-3 px-1">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <MessageSquare className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                        <div className="text-[11px] font-bold text-slate-700">Storage</div>
                        <div className="text-[9px] text-slate-400 font-semibold uppercase">Server Persisted</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
