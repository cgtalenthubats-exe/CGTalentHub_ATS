"use client";

import React, { useState, useMemo } from "react";
import { Search, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { type DemoFilterState } from "./types";

interface ChainCount {
    chain_name: string;
    candidate_count: number;
}

interface ChainRatingPickerProps {
    chainCounts: ChainCount[];
    subBrandsByChain: Record<string, string[]>;  // chain name → sub-brand names[]
    filters: DemoFilterState;
    onFiltersChange: (f: DemoFilterState) => void;
    onAutoSearch: (f: DemoFilterState) => void;
}

const RATINGS = ["3 Star", "4 Star", "5 Star"];
const RATING_LABEL: Record<string, string> = { "3 Star": "★★★", "4 Star": "★★★★", "5 Star": "★★★★★" };
const VISIBLE_CHAINS = 16;
const VISIBLE_SUB_BRANDS = 20;

export function ChainRatingPicker({ chainCounts, subBrandsByChain, filters, onFiltersChange, onAutoSearch }: ChainRatingPickerProps) {
    const [chainSearch, setChainSearch] = useState("");
    const [showAllChains, setShowAllChains] = useState(false);
    const [subBrandSearch, setSubBrandSearch] = useState("");
    const [showAllSubBrands, setShowAllSubBrands] = useState(false);

    // All sub-brands flat list (for "no filter" state)
    const allSubBrands = useMemo(
        () => [...new Set(Object.values(subBrandsByChain).flat())].sort(),
        [subBrandsByChain]
    );

    // Chain list
    const filteredChains = useMemo(() => {
        if (!chainSearch.trim()) return chainCounts;
        const q = chainSearch.toLowerCase();
        return chainCounts.filter(c => c.chain_name.toLowerCase().includes(q));
    }, [chainCounts, chainSearch]);

    const visibleChains = showAllChains || chainSearch.trim()
        ? filteredChains
        : filteredChains.slice(0, VISIBLE_CHAINS);

    const hasMoreChains = !chainSearch.trim() && chainCounts.length > VISIBLE_CHAINS;

    // Sub-brand list: filter client-side by selected chains instantly
    const hasChainOrRatingFilter = filters.hotel_chains.length > 0 || filters.hotel_ratings.length > 0;
    const activeSubBrands = useMemo(() => {
        if (filters.hotel_chains.length === 0) return allSubBrands;
        const filtered = filters.hotel_chains.flatMap(c => subBrandsByChain[c] ?? []);
        return [...new Set(filtered)].sort();
    }, [filters.hotel_chains, allSubBrands, subBrandsByChain]);

    const filteredSubBrands = useMemo(() => {
        if (!subBrandSearch.trim()) return activeSubBrands;
        const q = subBrandSearch.toLowerCase();
        return activeSubBrands.filter(b => b.toLowerCase().includes(q));
    }, [activeSubBrands, subBrandSearch]);

    const visibleSubBrands = showAllSubBrands || subBrandSearch.trim()
        ? filteredSubBrands
        : filteredSubBrands.slice(0, VISIBLE_SUB_BRANDS);

    const hasMoreSubBrands = !subBrandSearch.trim() && filteredSubBrands.length > VISIBLE_SUB_BRANDS;

    const toggleChain = (chain: string) => {
        const next = filters.hotel_chains.includes(chain)
            ? filters.hotel_chains.filter(c => c !== chain)
            : [...filters.hotel_chains, chain];
        const updated = { ...filters, hotel_chains: next, hotel_sub_brands: [] };
        onFiltersChange(updated);
        onAutoSearch(updated);
    };

    const toggleRating = (rating: string) => {
        const next = filters.hotel_ratings.includes(rating)
            ? filters.hotel_ratings.filter(r => r !== rating)
            : [...filters.hotel_ratings, rating];
        const updated = { ...filters, hotel_ratings: next, hotel_sub_brands: [] };
        onFiltersChange(updated);
        onAutoSearch(updated);
    };

    const toggleSubBrand = (brand: string) => {
        const next = filters.hotel_sub_brands.includes(brand)
            ? filters.hotel_sub_brands.filter(b => b !== brand)
            : [...filters.hotel_sub_brands, brand];
        const updated = { ...filters, hotel_sub_brands: next };
        onFiltersChange(updated);
        onAutoSearch(updated);
    };

    const clearAll = () => {
        const updated = { ...filters, hotel_chains: [], hotel_ratings: [], hotel_sub_brands: [] };
        onFiltersChange(updated);
        onAutoSearch(updated);
    };

    const hasAnyHotelFilter = filters.hotel_chains.length > 0 || filters.hotel_ratings.length > 0 || filters.hotel_sub_brands.length > 0;

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3 flex flex-col gap-2.5">
            {/* Header row */}
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hotel Chain & Rating</span>
                {hasAnyHotelFilter && (
                    <button
                        onClick={clearAll}
                        className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-red-500 transition-colors"
                    >
                        <X className="h-3 w-3" /> Clear
                    </button>
                )}
            </div>

            {/* Chain picker */}
            <div className="flex flex-col gap-1.5">
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
                    <input
                        value={chainSearch}
                        onChange={e => setChainSearch(e.target.value)}
                        placeholder="Search chains..."
                        className="w-full text-xs pl-6 pr-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-300 bg-slate-50"
                    />
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {visibleChains.map(c => {
                        const selected = filters.hotel_chains.includes(c.chain_name);
                        return (
                            <button
                                key={c.chain_name}
                                onClick={() => toggleChain(c.chain_name)}
                                className={cn(
                                    "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
                                    selected
                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                        : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-700"
                                )}
                            >
                                <span>{c.chain_name}</span>
                                <span className={cn("text-[10px]", selected ? "text-indigo-200" : "text-slate-400")}>
                                    {c.candidate_count}
                                </span>
                            </button>
                        );
                    })}
                    {hasMoreChains && (
                        <button
                            onClick={() => setShowAllChains(v => !v)}
                            className="flex items-center gap-0.5 px-2.5 py-1 rounded-full text-xs font-medium text-slate-500 border border-dashed border-slate-300 hover:border-slate-400 transition-colors"
                        >
                            {showAllChains ? (
                                <><ChevronUp className="h-3 w-3" /> Show less</>
                            ) : (
                                <><ChevronDown className="h-3 w-3" /> +{chainCounts.length - VISIBLE_CHAINS} more</>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Rating picker */}
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Rating</span>
                <div className="flex gap-1.5">
                    {RATINGS.map(r => {
                        const selected = filters.hotel_ratings.includes(r);
                        return (
                            <button
                                key={r}
                                onClick={() => toggleRating(r)}
                                className={cn(
                                    "px-3 py-1 rounded-full text-xs font-medium border transition-all",
                                    selected
                                        ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                                        : "bg-white text-slate-600 border-slate-200 hover:border-amber-300 hover:text-amber-700"
                                )}
                            >
                                {RATING_LABEL[r]}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Sub-brand picker — always visible */}
            {Object.keys(subBrandsByChain).length > 0 && (
                <div className="border-t border-slate-100 pt-2 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Sub-brands
                            {filters.hotel_chains.length > 0
                                ? ` (${activeSubBrands.length} in selected chain)`
                                : ` (${allSubBrands.length} total)`}
                        </span>
                        {filters.hotel_sub_brands.length > 0 && (
                            <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[9px] font-bold">
                                {filters.hotel_sub_brands.length} selected
                            </span>
                        )}
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
                        <input
                            value={subBrandSearch}
                            onChange={e => setSubBrandSearch(e.target.value)}
                            placeholder="Search sub-brands..."
                            className="w-full text-xs pl-6 pr-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-300 bg-slate-50"
                        />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {visibleSubBrands.map(brand => {
                            const selected = filters.hotel_sub_brands.includes(brand);
                            return (
                                <button
                                    key={brand}
                                    onClick={() => toggleSubBrand(brand)}
                                    className={cn(
                                        "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                                        selected
                                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                            : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-700"
                                    )}
                                >
                                    {brand}
                                </button>
                            );
                        })}
                        {hasMoreSubBrands && (
                            <button
                                onClick={() => setShowAllSubBrands(v => !v)}
                                className="flex items-center gap-0.5 px-2.5 py-1 rounded-full text-xs font-medium text-slate-500 border border-dashed border-slate-300 hover:border-slate-400 transition-colors"
                            >
                                {showAllSubBrands ? (
                                    <><ChevronUp className="h-3 w-3" /> Show less</>
                                ) : (
                                    <><ChevronDown className="h-3 w-3" /> +{filteredSubBrands.length - VISIBLE_SUB_BRANDS} more</>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
