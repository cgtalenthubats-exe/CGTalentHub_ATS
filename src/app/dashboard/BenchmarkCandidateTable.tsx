"use client";

import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { ArrowDown, ArrowUp, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { parseSalary } from "@/lib/benchmark-utils";
import { COMPENSATION_FIELDS } from "@/lib/compensation-fields";
import { benefitState } from "@/lib/compensation";
import { cn } from "@/lib/utils";
import { CandidateProfileSheet } from "@/components/candidate-profile-sheet";
import type { BenchmarkCandidate } from "@/app/actions/benchmark-actions";

/**
 * The people behind the Salary Benchmark numbers: one row per candidate in the current filter, with
 * the position and company the figure belongs to. Names are hidden unless asked for (the rest of the
 * tab is aggregate-only), and the Excel export follows that same switch.
 */

const PAGE = 50;
const thb = (n: number | null) => (n === null ? "—" : `฿${Math.round(n).toLocaleString()}`);

type SortKey = "salary" | "position" | "company" | "hotel_chain" | "rating";

export const BENCHMARK_TABLE_ID = "benchmark-candidate-table";

export function BenchmarkCandidateTable({ rows, filterSummary, stats }: {
    rows: BenchmarkCandidate[];
    /** Human-readable list of the active filters, written into the Excel "Summary" sheet. */
    filterSummary: string[];
    stats: { n: number; median: number; p25: number; p75: number; min: number; max: number } | null;
}) {
    const [showNames, setShowNames] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>("salary");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [limit, setLimit] = useState(PAGE);
    // Candidate whose profile slide-over is open (same panel the Recruiter Performance details use).
    const [profileId, setProfileId] = useState<string | null>(null);

    const withSalary = useMemo(
        () => rows
            .map(c => ({ c, salary: parseSalary(c.gross_salary_base_b_mth) ?? 0 }))
            .filter(r => r.salary > 0),
        [rows]
    );

    const sorted = useMemo(() => {
        const dir = sortDir === "asc" ? 1 : -1;
        return [...withSalary].sort((a, b) => {
            if (sortKey === "salary") return (a.salary - b.salary) * dir;
            const av = ((a.c as any)[sortKey] ?? "") as string;
            const bv = ((b.c as any)[sortKey] ?? "") as string;
            // Blanks always last, whichever direction.
            if (!av && bv) return 1;
            if (av && !bv) return -1;
            return av.localeCompare(bv) * dir;
        });
    }, [withSalary, sortKey, sortDir]);

    const toggleSort = (key: SortKey) => {
        if (key === sortKey) setSortDir(d => (d === "asc" ? "desc" : "asc"));
        else { setSortKey(key); setSortDir(key === "salary" ? "desc" : "asc"); }
        setLimit(PAGE);
    };

    const exportExcel = () => {
        const benefitFields = COMPENSATION_FIELDS.filter(f => !f.retired && f.key !== "gross_salary_base_b_mth");
        const header = [
            "Candidate ID",
            ...(showNames ? ["Name"] : []),
            "Position", "Company", "Hotel Chain", "Hotel Rating", "Industry", "Company Group", "Job Function",
            "Base Salary (฿/month)",
            ...benefitFields.map(f => (f.unit ? `${f.label} (${f.unit})` : f.label)),
        ];
        const body = sorted.map(({ c, salary }) => [
            c.candidate_id,
            ...(showNames ? [c.name] : []),
            c.position ?? "", c.company ?? "", c.hotel_chain ?? "", c.rating ?? "", c.company_industry ?? "", c.company_group ?? "", c.job_function ?? "",
            salary,
            ...benefitFields.map(f => {
                const state = benefitState(f, c);
                if (state === "amount") return (c as any)[f.key] ?? "";
                if (state === "provided") return "Provided";
                if (state === "none") return "None";
                return "";
            }),
        ]);

        const summary: (string | number)[][] = [
            ["Salary Benchmark export"],
            ["Exported on", new Date().toLocaleString()],
            ["Candidates (with base salary)", sorted.length],
            ["Names included", showNames ? "Yes" : "No"],
            [],
            ["Filters applied", filterSummary.length ? "" : "None"],
            ...filterSummary.map(line => ["", line]),
            [],
            ...(stats ? [
                ["Median (฿/month)", Math.round(stats.median)],
                ["P25", Math.round(stats.p25)],
                ["P75", Math.round(stats.p75)],
                ["Min", Math.round(stats.min)],
                ["Max", Math.round(stats.max)],
            ] as (string | number)[][] : []),
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
        ws["!cols"] = header.map((h, i) => ({ wch: i === 0 ? 12 : Math.min(Math.max(String(h).length + 2, 14), 34) }));
        XLSX.utils.book_append_sheet(wb, ws, "Candidates");
        const ws2 = XLSX.utils.aoa_to_sheet(summary);
        ws2["!cols"] = [{ wch: 30 }, { wch: 60 }];
        XLSX.utils.book_append_sheet(wb, ws2, "Summary");
        XLSX.writeFile(wb, `salary-benchmark-${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const SortHead = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
        <th className={cn("px-4 py-2 text-left", className)}>
            <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 uppercase tracking-wider font-black hover:text-slate-800">
                {label}
                {sortKey === k && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
            </button>
        </th>
    );

    return (
        <Card id={BENCHMARK_TABLE_ID} className="border-slate-200 scroll-mt-4">
            <CardContent className="p-0">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                        Candidates behind these numbers
                        <span className="ml-2 text-slate-400 normal-case font-semibold tracking-normal">{sorted.length} in the current filter</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 cursor-pointer select-none">
                            <input type="checkbox" checked={showNames} onChange={e => setShowNames(e.target.checked)} />
                            Show names
                        </label>
                        <Button size="sm" variant="outline" className="gap-2" onClick={exportExcel} disabled={sorted.length === 0}>
                            <Download className="h-3.5 w-3.5" /> Export Excel
                        </Button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-[10px] text-slate-500">
                            <tr>
                                <th className="px-4 py-2 text-left uppercase tracking-wider font-black">ID{showNames ? " / Name" : ""}</th>
                                <SortHead k="position" label="Position" />
                                <SortHead k="company" label="Company" />
                                <SortHead k="hotel_chain" label="Hotel Chain" />
                                <SortHead k="rating" label="Rating" />
                                <th className="px-4 py-2 text-left uppercase tracking-wider font-black">Industry</th>
                                <th className="px-4 py-2 text-right">
                                    <button onClick={() => toggleSort("salary")} className="inline-flex items-center gap-1 uppercase tracking-wider font-black hover:text-slate-800">
                                        Base salary / mo
                                        {sortKey === "salary" && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                                    </button>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sorted.slice(0, limit).map(({ c, salary }) => (
                                <tr key={c.candidate_id} className="hover:bg-slate-50/60">
                                    <td className="px-4 py-2 font-mono text-xs text-slate-500 whitespace-nowrap">
                                        <button
                                            onClick={() => setProfileId(c.candidate_id)}
                                            className="text-indigo-600 hover:text-indigo-800 hover:underline underline-offset-2"
                                            title="Open profile"
                                        >
                                            {c.candidate_id}
                                        </button>
                                        {showNames && c.name ? <span className="ml-2 font-sans font-semibold text-slate-700">{c.name}</span> : null}
                                    </td>
                                    <td className="px-4 py-2 font-semibold text-slate-700 max-w-[240px] truncate" title={c.position ?? ""}>{c.position || "—"}</td>
                                    <td className="px-4 py-2 text-slate-600 max-w-[200px] truncate" title={c.company ?? ""}>{c.company || "—"}</td>
                                    <td className="px-4 py-2 text-slate-500 max-w-[160px] truncate" title={c.hotel_chain ?? ""}>{c.hotel_chain || "—"}</td>
                                    <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{c.rating || "—"}</td>
                                    <td className="px-4 py-2 text-slate-500 max-w-[160px] truncate" title={c.company_industry ?? ""}>{c.company_industry || "—"}</td>
                                    <td className="px-4 py-2 text-right font-black text-slate-800 whitespace-nowrap">{thb(salary)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {sorted.length > limit && (
                    <div className="p-3 border-t border-slate-100 flex justify-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setLimit(l => l + PAGE)}>Show {Math.min(PAGE, sorted.length - limit)} more</Button>
                        <Button size="sm" variant="ghost" onClick={() => setLimit(sorted.length)}>Show all {sorted.length}</Button>
                    </div>
                )}
            </CardContent>
            <CandidateProfileSheet
                candidateId={profileId}
                open={!!profileId}
                onOpenChange={(open) => { if (!open) setProfileId(null); }}
            />
        </Card>
    );
}
