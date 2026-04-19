"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Building2, Filter, Layers, Briefcase, Plus, MoreHorizontal, ArrowLeft, Loader2, Globe, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import HierarchySidebar from "./HierarchySidebar";
import CompanyDataTable from "./CompanyDataTable";
import { getCompaniesPaginated, globalCompanySearch } from "@/app/actions/company-mgmt";
import { toast } from "@/lib/notifications"; // Assuming sonner is available

interface CompanyStats {
    groups: Record<string, number>;
    industriesByGroup: Record<string, Record<string, number>>;
}

export default function CompanyManagementClient({ initialStats }: { initialStats: CompanyStats }) {
    // Selection state
    const [selectedGroup, setSelectedGroup] = useState<string>("Retail / FMCG / F&B");
    const [selectedIndustry, setSelectedIndustry] = useState<string>("All");
    
    // Search state
    const [searchTerm, setSearchTerm] = useState("");
    const [globalSearchTerm, setGlobalSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Data state
    const [companies, setCompanies] = useState<any[]>([]);
    const [totalResults, setTotalResults] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize] = useState(50);

    const fetchCompanies = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await getCompaniesPaginated({
                group: selectedGroup,
                industry: selectedIndustry,
                search: searchTerm,
                page: currentPage,
                pageSize: pageSize
            });
            setCompanies(result.data);
            setTotalResults(result.total);
        } catch (error) {
            console.error("Fetch error:", error);
            toast.error("Failed to load companies");
        } finally {
            setIsLoading(false);
        }
    }, [selectedGroup, selectedIndustry, searchTerm, currentPage, pageSize]);

    useEffect(() => {
        fetchCompanies();
    }, [fetchCompanies]);

    // Global Search Logic
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
        setSelectedGroup(result.group || "Unassigned");
        setSelectedIndustry(result.industry || "Unassigned");
        setSearchTerm(result.company_master);
        setGlobalSearchTerm("");
        setSearchResults([]);
        setCurrentPage(0);
    };

    return (
        <div className="flex gap-6 h-full min-h-[700px]">
            {/* Left: Sidebar Navigation */}
            <div className="w-[320px] shrink-0 flex flex-col gap-4">
                <HierarchySidebar 
                    stats={initialStats} 
                    selectedGroup={selectedGroup}
                    setSelectedGroup={(g) => { setSelectedGroup(g); setSelectedIndustry("All"); setCurrentPage(0); }}
                    selectedIndustry={selectedIndustry}
                    setSelectedIndustry={(i) => { setSelectedIndustry(i); setCurrentPage(0); }}
                />
            </div>

            {/* Right: Content Area */}
            <div className="flex-1 flex flex-col gap-4 min-w-0">
                <div className="flex gap-4 items-center bg-white p-4 rounded-xl border shadow-sm relative z-20">
                    <div className="flex-1 relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="Global Search (Master or Variant)..." 
                            className="pl-9 pr-10 h-11 bg-slate-50/50 border-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            value={globalSearchTerm}
                            onChange={(e) => setGlobalSearchTerm(e.target.value)}
                        />
                        {globalSearchTerm && (
                            <button 
                                onClick={() => setGlobalSearchTerm("")}
                                className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                        {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />}
                        
                        {/* Search Results Dropdown */}
                        {searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-xl shadow-2xl p-2 max-h-[400px] overflow-y-auto">
                                {searchResults.map((res: any) => (
                                    <button
                                        key={res.company_id}
                                        onClick={() => handleJumpToResult(res)}
                                        className="w-full text-left p-3 hover:bg-slate-50 rounded-lg transition-colors flex flex-col"
                                    >
                                        <div className="flex justify-between items-center group">
                                            <span className="font-semibold text-slate-900">{res.company_master}</span>
                                            <Badge variant="outline" className="text-[10px] uppercase">{res.matchType}</Badge>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs text-slate-500">{res.group}</span>
                                            <span className="text-[10px] text-slate-300">/</span>
                                            <span className="text-xs text-slate-500">{res.industry}</span>
                                        </div>
                                        {res.matchDetail && (
                                            <div className="mt-1 text-[11px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded inline-block w-fit">
                                                Match: "{res.matchDetail}"
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <Card className="flex-1 flex flex-col border-none shadow-sm overflow-hidden bg-white">
                    <div className="p-4 border-b flex justify-between items-center bg-slate-50/50">
                        <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-indigo-600" />
                            <h2 className="font-bold text-slate-900">{selectedIndustry === 'All' ? selectedGroup : selectedIndustry}</h2>
                            <Badge variant="secondary" className="ml-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100">{totalResults} Companies</Badge>
                        </div>
                        <div className="flex gap-2">
                             <div className="relative">
                                <Input 
                                    placeholder="Filter selection..." 
                                    className="w-[240px] h-9 pr-8"
                                    value={searchTerm}
                                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(0); }}
                                />
                                {searchTerm && (
                                    <button 
                                        onClick={() => setSearchTerm("")}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                             </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                        <CompanyDataTable 
                            data={companies} 
                            isLoading={isLoading} 
                            total={totalResults}
                            page={currentPage}
                            pageSize={pageSize}
                            setPage={setCurrentPage}
                            onRefresh={fetchCompanies}
                        />
                    </div>
                </Card>
            </div>
        </div>
    );
}
