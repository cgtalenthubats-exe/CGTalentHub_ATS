"use client";

import { useEffect, useState } from "react";
import { getSetCompanies } from "@/app/actions/company-mgmt";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Users, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SetCompaniesTab() {
    const [companies, setCompanies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        getSetCompanies()
            .then(data => setCompanies(data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const filtered = companies.filter(c =>
        !search ||
        c.symbol?.toLowerCase().includes(search.toLowerCase()) ||
        c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.sector?.toLowerCase().includes(search.toLowerCase())
    );

    const mapped = companies.filter(c => c.company_master_id !== null);
    const totalCandidates = companies.reduce((sum, c) => sum + (c.candidate_count || 0), 0);

    return (
        <div className="flex flex-col gap-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total SET Companies</p>
                    <p className="text-2xl font-black text-slate-800">{companies.length}</p>
                </div>
                <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Mapped to Company Master</p>
                    <p className="text-2xl font-black text-emerald-600">{mapped.length}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{companies.length ? Math.round(mapped.length / companies.length * 100) : 0}% coverage</p>
                </div>
                <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Candidates (mapped)</p>
                    <p className="text-2xl font-black text-indigo-600">{totalCandidates.toLocaleString()}</p>
                </div>
            </div>

            {/* Search */}
            <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                    placeholder="Search symbol, company, sector..."
                    className="pl-9 h-9 bg-slate-50 border-slate-200 text-sm"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 py-3 px-4 w-20">Symbol</th>
                            <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 py-3 px-4">Company Name</th>
                            <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 py-3 px-4 w-28">Index Group</th>
                            <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 py-3 px-4">Sector</th>
                            <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 py-3 px-4 w-28">Mapping</th>
                            <th className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400 py-3 px-4 w-24">Candidates</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="py-20 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin text-slate-300 mx-auto" />
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-20 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                                    No companies found
                                </td>
                            </tr>
                        ) : filtered.map((c, i) => (
                            <tr
                                key={c.id}
                                className={cn(
                                    "border-b border-slate-50 hover:bg-slate-50/50 transition-colors",
                                    i % 2 === 0 ? "" : "bg-slate-50/30"
                                )}
                            >
                                <td className="py-3 px-4">
                                    <span className="font-black text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">{c.symbol}</span>
                                </td>
                                <td className="py-3 px-4 font-semibold text-slate-800">{c.company_name}</td>
                                <td className="py-3 px-4">
                                    <Badge variant="outline" className="text-[10px] font-bold">{c.index_group || "—"}</Badge>
                                </td>
                                <td className="py-3 px-4 text-slate-500 text-xs">{c.sector || "—"}</td>
                                <td className="py-3 px-4">
                                    {c.company_master_id ? (
                                        <div className="flex items-center gap-1 text-emerald-600">
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            <span className="text-[10px] font-bold">Matched</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 text-slate-300">
                                            <AlertCircle className="h-3.5 w-3.5" />
                                            <span className="text-[10px] font-bold">No match</span>
                                        </div>
                                    )}
                                </td>
                                <td className="py-3 px-4 text-right">
                                    {c.candidate_count !== null ? (
                                        <div className="flex items-center justify-end gap-1">
                                            <Users className="h-3 w-3 text-slate-400" />
                                            <span className="font-black text-slate-700">{c.candidate_count.toLocaleString()}</span>
                                        </div>
                                    ) : (
                                        <span className="text-slate-300 text-xs">—</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
                Matching is done by exact company name. Companies without a match need manual mapping via Company Master.
            </p>
        </div>
    );
}
