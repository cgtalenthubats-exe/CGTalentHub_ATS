"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Building2, Globe, X, Hotel, Loader2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import CompanyDataTable from "./CompanyDataTable";
import HotelChainMappingTab from "./HotelChainMappingTab";
import { getCompaniesPaginated, globalCompanySearch } from "@/app/actions/company-mgmt";
import { toast } from "@/lib/notifications";

const KNOWN_UNKNOWN_GROUPS = new Set([
    "Unknown", "Unassigned", "N/A", "Not Found",
    "No Match Found", "Undetermined", "Unclassified",
]);

function shortGroupName(name: string): string {
    const MAP: Record<string, string> = {
        "Hospitality & Real Estate": "Hospitality",
        "Retail / FMCG / F&B": "Retail / F&B",
        "Others": "Others",
    };
    if (MAP[name]) return MAP[name];
    const firstSegment = name.split(" / ")[0];
    const firstWord = firstSegment.split(" ")[0];
    return firstWord.length >= 6 ? firstWord : firstSegment.slice(0, 14);
}

interface CompanyStats {
    groups: Record<string, number>;
    industriesByGroup: Record<string, Record<string, number>>;
}

export default function CompanyManagementClient({ initialStats }: { initialStats: CompanyStats }) {
    const [activeTab, setActiveTab] = useState<"companies" | "hotel_mapping">("companies");

    const mainGroups = useMemo(
        () => Object.keys(initialStats.groups)
            .filter(g => !KNOWN_UNKNOWN_GROUPS.has(g))
            .sort((a, b) => initialStats.groups[b] - initialStats.groups[a]),
        [initialStats.groups]
    );

    const unknownGroups = useMemo(
        () => Object.keys(initialStats.groups).filter(g => KNOWN_UNKNOWN_GROUPS.has(g)),
        [initialStats.groups]
    );

    const unknownCount = useMemo(
        () => unknownGroups.reduce((sum, g) => sum + (initialStats.groups[g] || 0), 0),
        [unknownGroups, initialStats.groups]
    );

    const [selectedGroup, setSelectedGroup] = useState<string>(mainGroups[0] || "");
    const [isUnclassified, setIsUnclassified] = useState(false);
    const [selectedIndustry, setSelectedIndustry] = useState("All");

    const [searchTerm, setSearchTerm] = useState("");
    const [globalSearchTerm, setGlobalSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const [companies, setCompanies] = useState<any[]>([]);
    const [totalResults, setTotalResults] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize] = useState(50);

    const industries = useMemo(
        () => isUnclassified ? [] : Object.keys(initialStats.industriesByGroup[selectedGroup] || {}).sort(),
        [isUnclassified, selectedGroup, initialStats.industriesByGroup]
    );

    const fetchCompanies = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await getCompaniesPaginated({
                group: isUnclassified ? undefined : selectedGroup,
                groups: isUnclassified ? unknownGroups : undefined,
                industry: selectedIndustry,
                search: searchTerm,
                page: currentPage,
                pageSize,
            });
            setCompanies(result.data);
            setTotalResults(result.total);
        } catch {
            toast.error("Failed to load companies");
        } finally {
            setIsLoading(false);
        }
    }, [selectedGroup, isUnclassified, unknownGroups, selectedIndustry, searchTerm, currentPage, pageSize]);

    useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

    const handleSelectGroup = (group: string) => {
        setSelectedGroup(group);
        setIsUnclassified(false);
        setSelectedIndustry("All");
        setCurrentPage(0);
    };

    const handleSelectUnclassified = () => {
        setIsUnclassified(true);
        setSelectedIndustry("All");
        setCurrentPage(0);
    };

    // Global search debounce
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (globalSearchTerm.length > 1) {
                setIsSearching(true);
                const results = await globalCompanySearch(globalSearchTerm);
                setSearchResults(results);
                setIsSearching(false);
            } else {
                setSearchResults([]);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [globalSearchTerm]);

    const handleJumpToResult = (result: any) => {
        const group = result.group || "Unknown";
        if (KNOWN_UNKNOWN_GROUPS.has(group)) {
            setIsUnclassified(true);
        } else {
            setSelectedGroup(group);
            setIsUnclassified(false);
        }
        setSelectedIndustry(result.industry || "All");
        setSearchTerm(result.company_master);
        setGlobalSearchTerm("");
        setSearchResults([]);
        setCurrentPage(0);
    };

    return (
        <div className="flex flex-col gap-4 min-h-[700px]">
            {/* Main tab bar */}
            <div className="flex gap-1 border-b pb-0">
                <button
                    onClick={() => setActiveTab("companies")}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                        activeTab === "companies"
                            ? "border-indigo-600 text-indigo-600"
                            : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                >
                    <Building2 className="h-4 w-4" />
                    Company Master
                </button>
                <button
                    onClick={() => setActiveTab("hotel_mapping")}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                        activeTab === "hotel_mapping"
                            ? "border-indigo-600 text-indigo-600"
                            : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                >
                    <Hotel className="h-4 w-4" />
                    Hotel Chain Mapping
                </button>
            </div>

            {activeTab === "hotel_mapping" && <HotelChainMappingTab />}

            {activeTab === "companies" && (
                <div className="flex flex-col gap-3 flex-1">
                    {/* Group tabs + toolbar in one card */}
                    <div className="bg-white rounded-xl border shadow-sm">
                        {/* Group tab row */}
                        <div className="flex items-center gap-1 px-3 pt-3 pb-0 overflow-x-auto">
                            {mainGroups.map(group => {
                                const isActive = !isUnclassified && selectedGroup === group;
                                return (
                                    <button
                                        key={group}
                                        onClick={() => handleSelectGroup(group)}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap transition-colors shrink-0 border-b-2",
                                            isActive
                                                ? "bg-indigo-50 text-indigo-700 border-indigo-500"
                                                : "text-slate-600 hover:bg-slate-50 border-transparent"
                                        )}
                                    >
                                        <span>{shortGroupName(group)}</span>
                                        <span className={cn(
                                            "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                                            isActive ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                                        )}>
                                            {(initialStats.groups[group] || 0).toLocaleString()}
                                        </span>
                                    </button>
                                );
                            })}

                            {unknownCount > 0 && (
                                <>
                                    <div className="w-px h-6 bg-slate-200 mx-1 shrink-0 self-center" />
                                    <button
                                        onClick={handleSelectUnclassified}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap transition-colors shrink-0 border-b-2",
                                            isUnclassified
                                                ? "bg-amber-50 text-amber-700 border-amber-400"
                                                : "text-slate-500 hover:bg-slate-50 border-transparent"
                                        )}
                                    >
                                        <AlertTriangle className={cn(
                                            "h-3.5 w-3.5",
                                            isUnclassified ? "text-amber-500" : "text-slate-400"
                                        )} />
                                        <span>Unclassified</span>
                                        <span className={cn(
                                            "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                                            isUnclassified ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                                        )}>
                                            {unknownCount.toLocaleString()}
                                        </span>
                                    </button>
                                </>
                            )}
                        </div>

                        <div className="border-t" />

                        {/* Toolbar row */}
                        <div className="flex items-center gap-2 px-3 py-2.5">
                            {/* Global search */}
                            <div className="relative w-64">
                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                <Input
                                    placeholder="Search company or variant..."
                                    className="pl-9 pr-8 h-9 bg-slate-50 border-slate-200 text-sm focus-visible:ring-indigo-500"
                                    value={globalSearchTerm}
                                    onChange={e => setGlobalSearchTerm(e.target.value)}
                                />
                                {globalSearchTerm && !isSearching && (
                                    <button
                                        onClick={() => setGlobalSearchTerm("")}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                                {isSearching && (
                                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
                                )}

                                {/* Global search dropdown */}
                                {searchResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-2xl p-1.5 max-h-[360px] overflow-y-auto z-50 min-w-[380px]">
                                        {searchResults.map((res: any) => (
                                            <button
                                                key={res.company_id}
                                                onClick={() => handleJumpToResult(res)}
                                                className="w-full text-left px-3 py-2.5 hover:bg-slate-50 rounded-lg transition-colors flex flex-col gap-0.5"
                                            >
                                                <div className="flex justify-between items-center gap-2">
                                                    <span className="font-semibold text-slate-900 text-sm truncate">{res.company_master}</span>
                                                    <Badge variant="outline" className="text-[10px] uppercase shrink-0">{res.matchType}</Badge>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs text-slate-400">{res.group}</span>
                                                    <span className="text-[10px] text-slate-300">/</span>
                                                    <span className="text-xs text-slate-400">{res.industry}</span>
                                                </div>
                                                {res.matchDetail && (
                                                    <span className="text-[11px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded w-fit">
                                                        Match: &ldquo;{res.matchDetail}&rdquo;
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Industry filter */}
                            {!isUnclassified && industries.length > 0 && (
                                <Select
                                    value={selectedIndustry}
                                    onValueChange={v => { setSelectedIndustry(v); setCurrentPage(0); }}
                                >
                                    <SelectTrigger className="w-52 h-9 text-sm border-slate-200 bg-slate-50 focus:ring-indigo-500">
                                        <SelectValue placeholder="All Industries" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="All">All Industries</SelectItem>
                                        {industries.map(ind => (
                                            <SelectItem key={ind} value={ind}>
                                                {ind}
                                                <span className="text-slate-400 text-xs ml-1.5">
                                                    ({initialStats.industriesByGroup[selectedGroup]?.[ind] ?? 0})
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}

                            {/* Filter within selection */}
                            <div className="relative ml-auto">
                                <Input
                                    placeholder="Filter selection..."
                                    className="w-48 h-9 text-sm border-slate-200 pr-7"
                                    value={searchTerm}
                                    onChange={e => { setSearchTerm(e.target.value); setCurrentPage(0); }}
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm("")}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Active filter summary */}
                            <div className="flex items-center gap-1.5 text-sm text-slate-500 shrink-0">
                                <span className="font-bold text-slate-900">{totalResults.toLocaleString()}</span>
                                <span>companies</span>
                                {selectedIndustry !== "All" && (
                                    <Badge variant="secondary" className="text-xs ml-1">
                                        {selectedIndustry}
                                        <button
                                            onClick={() => setSelectedIndustry("All")}
                                            className="ml-1 hover:text-red-500"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <Card className="flex-1 border-none shadow-sm overflow-hidden bg-white">
                        <CompanyDataTable
                            data={companies}
                            isLoading={isLoading}
                            total={totalResults}
                            page={currentPage}
                            pageSize={pageSize}
                            setPage={setCurrentPage}
                            onRefresh={fetchCompanies}
                            groups={mainGroups}
                            industriesByGroup={initialStats.industriesByGroup}
                        />
                    </Card>
                </div>
            )}
        </div>
    );
}
