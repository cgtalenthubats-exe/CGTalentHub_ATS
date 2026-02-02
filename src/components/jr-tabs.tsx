"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface Tab {
    id: string;
    title: string;
}

interface JRTabsProps {
    activeId: string | undefined;
    onSelect: (id: string) => void;
    onAdd?: () => void;
}

export function JRTabs({ activeId, onSelect, onAdd }: JRTabsProps) {
    const [tabs, setTabs] = useState<Tab[]>([]);

    useEffect(() => {
        // Load from LocalStorage
        try {
            const stored = localStorage.getItem("ats_jr_tabs");
            if (stored) setTabs(JSON.parse(stored));
        } catch (e) {
            console.error("Failed to load tabs", e);
        }
    }, []);

    // Save when activeId changes (add active to tabs)
    useEffect(() => {
        if (!activeId || activeId === 'new') return; // Don't save 'new' tab yet

        // Find existing or add new
        // Ideally we need the title. Since we don't have it here easily unless passed, 
        // we might rely on the parent updating tabs or fetching the title.
        // For now, let's assume if it's not in tabs, we can't fully add it properly without title.
        // BUT, the JRSwitcher should responsibly add it. 
        // Let's rely on an event or external helper? 
        // Simplest: Parent passes "activeTitle" too.

    }, [activeId]);

    const removeTab = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const newTabs = tabs.filter(t => t.id !== id);
        setTabs(newTabs);
        localStorage.setItem("ats_jr_tabs", JSON.stringify(newTabs));

        if (id === activeId) {
            if (newTabs.length > 0) {
                onSelect(newTabs[newTabs.length - 1].id);
            } else {
                onSelect(""); // Clear
            }
        }
    };

    return (
        <div className="flex items-center gap-1 border-b px-4 bg-slate-100 dark:bg-slate-900 pt-2 overflow-x-auto">
            {tabs.map(tab => (
                <div
                    key={tab.id}
                    onClick={() => onSelect(tab.id)}
                    className={`
                        group flex items-center gap-2 px-3 py-1.5 min-w-[120px] max-w-[200px] text-xs font-medium rounded-t-lg cursor-pointer border-t border-x
                        ${tab.id === activeId || (activeId === undefined && tabs.length === 0)
                            ? "bg-white dark:bg-black border-slate-200 dark:border-slate-800 text-foreground"
                            : "bg-slate-200 dark:bg-slate-800 border-transparent text-muted-foreground hover:bg-slate-300 dark:hover:bg-slate-700"}
                    `}
                >
                    <span className="truncate flex-1">{tab.title}</span>
                    <button
                        onClick={(e) => removeTab(e, tab.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-full transition-opacity"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            ))}

            {/* New Tab Button */}
            <div
                onClick={onAdd}
                className={`
                    flex items-center justify-center p-1.5 rounded-t-lg cursor-pointer transition-colors
                    ${activeId === 'new'
                        ? "bg-white dark:bg-black border-t border-x border-slate-200 dark:border-slate-800 text-foreground"
                        : "hover:bg-slate-200 dark:hover:bg-slate-800 text-muted-foreground"}
                `}
                title="New Requisition"
            >
                <Plus className="h-4 w-4" />
            </div>
        </div>
    );
}

import { Plus } from "lucide-react";
