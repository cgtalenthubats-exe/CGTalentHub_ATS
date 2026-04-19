"use client";

import React, { useState } from "react";
import { ChevronRight, ChevronDown, Building2, Briefcase, LayoutGrid, Layers } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface HierarchySidebarProps {
    stats: {
        groups: Record<string, number>;
        industriesByGroup: Record<string, Record<string, number>>;
    };
    selectedGroup: string;
    setSelectedGroup: (group: string) => void;
    selectedIndustry: string;
    setSelectedIndustry: (industry: string) => void;
}

export default function HierarchySidebar({
    stats,
    selectedGroup,
    setSelectedGroup,
    selectedIndustry,
    setSelectedIndustry
}: HierarchySidebarProps) {
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
        [selectedGroup]: true
    });

    const toggleGroup = (group: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [group]: !prev[group]
        }));
    };

    const sortedGroups = Object.keys(stats.groups).sort((a, b) => stats.groups[b] - stats.groups[a]);

    return (
        <div className="flex flex-col h-full bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FilterIcon className="h-4 w-4 text-indigo-600" />
                    <span className="font-bold text-slate-900 tracking-tight">Group</span>
                </div>
            </div>

            <ScrollArea className="flex-1 p-2">
                <div className="space-y-1">
                    {sortedGroups.map((group) => {
                        const isSelected = selectedGroup === group;
                        const isExpanded = expandedGroups[group];
                        const industries = stats.industriesByGroup[group] || {};
                        const sortedIndustries = Object.keys(industries).sort();

                        return (
                            <div key={group} className="space-y-1">
                                <button
                                    onClick={() => {
                                        setSelectedGroup(group);
                                        toggleGroup(group);
                                    }}
                                    className={cn(
                                        "w-full flex items-center justify-between p-2 rounded-lg transition-all group",
                                        isSelected 
                                            ? "bg-indigo-50 text-indigo-700 shadow-sm border-l-4 border-l-indigo-600" 
                                            : "hover:bg-slate-50 text-slate-600 border-l-4 border-l-transparent"
                                    )}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        {isExpanded ? (
                                            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                                        )}
                                        <span className="font-semibold text-sm truncate">{group}</span>
                                    </div>
                                    <span className={cn(
                                        "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                                        isSelected ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                                    )}>
                                        {stats.groups[group]}
                                    </span>
                                </button>

                                {isExpanded && (
                                    <div className="ml-7 pl-2 border-l border-slate-100 space-y-0.5 py-1">
                                        <button
                                            onClick={() => setSelectedIndustry("All")}
                                            className={cn(
                                                "w-full flex items-center justify-between p-1.5 rounded-md text-xs transition-colors",
                                                selectedIndustry === "All" && isSelected
                                                    ? "bg-slate-100 text-slate-900 font-bold"
                                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                            )}
                                        >
                                            <span className="truncate">All Industries</span>
                                        </button>
                                        
                                        {sortedIndustries.map(industry => (
                                            <button
                                                key={industry}
                                                onClick={() => setSelectedIndustry(industry)}
                                                className={cn(
                                                    "w-full flex items-center justify-between p-1.5 rounded-md text-xs transition-colors group",
                                                    selectedIndustry === industry && isSelected
                                                        ? "bg-indigo-50/50 text-indigo-600 font-bold"
                                                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-700 underline-offset-4"
                                                )}
                                            >
                                                <span className="truncate">{industry}</span>
                                                <span className="text-[10px] text-slate-300 group-hover:text-slate-400 font-medium">
                                                    {industries[industry]}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
        </div>
    );
}

function FilterIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
        </svg>
    );
}
