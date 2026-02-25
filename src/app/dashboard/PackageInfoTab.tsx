"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { getRawBenchmarkData, BenchmarkCandidate } from "@/app/actions/benchmark-actions";
import { parseSalary, hasBenefit } from "@/lib/benchmark-utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RotateCcw, RefreshCw, CheckCircle2, Minus } from "lucide-react";

// ---- Benefit row definitions ----
const BENEFIT_ROWS = [
    { key: "bonus_mth", label: "Bonus (mth)" },
    { key: "car_allowance_b_mth", label: "Car Allowance" },
    { key: "gasoline_b_mth", label: "Gasoline" },
    { key: "phone_b_mth", label: "Phone" },
    { key: "provident_fund_pct", label: "Provident Fund" },
    { key: "medical_b_annual", label: "Medical (Annual)" },
    { key: "medical_b_mth", label: "Medical (Monthly)" },
    { key: "insurance", label: "Insurance" },
    { key: "housing_for_expat_b_mth", label: "Housing (Expat)" },
    { key: "other_income", label: "Other Income" },
    { key: "others_benefit", label: "Others" },
] as const;

function formatK(val: number | null): string {
    if (val === null) return "-";
    return `${Math.round(val / 1000)}K`;
}

// ---- Salary dot chart per company ----
function SalaryDotChart({ companies, dataByCompany }: {
    companies: string[];
    dataByCompany: Record<string, { salaries: number[]; min: number; max: number; avg: number }>;
}) {
    const globalMax = Math.max(...companies.map(c => dataByCompany[c]?.max ?? 0), 1);
    const globalMin = Math.min(...companies.map(c => dataByCompany[c]?.min ?? globalMax), 0);
    const range = globalMax - globalMin || 1;

    return (
        <div className="overflow-x-auto">
            <div style={{ minWidth: `${Math.max(companies.length * 120, 600)}px` }}>
                {/* Company headers */}
                <div className="flex">
                    <div className="w-32 shrink-0" />
                    {companies.map(c => (
                        <div key={c} className="flex-1 text-center px-1">
                            <div className="text-[10px] font-semibold text-slate-700 leading-tight break-words min-h-[48px] flex items-end justify-center pb-1"
                                style={{ writingMode: 'horizontal-tb' }}>
                                {c || "Unknown"}
                            </div>
                            <div className="text-xs font-bold text-indigo-700 mt-1">
                                {formatK(dataByCompany[c]?.avg ?? null)}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Chart area */}
                <div className="flex mt-2" style={{ height: "160px" }}>
                    <div className="w-32 shrink-0 flex flex-col justify-between text-right pr-2 text-[10px] text-slate-400">
                        <span>{formatK(globalMax)}</span>
                        <span>{formatK((globalMax + globalMin) / 2)}</span>
                        <span>{formatK(globalMin)}</span>
                    </div>
                    {companies.map(c => {
                        const d = dataByCompany[c];
                        if (!d) return <div key={c} className="flex-1" />;
                        const toY = (v: number) => ((globalMax - v) / range) * 100;
                        return (
                            <div key={c} className="flex-1 relative border-l border-slate-100">
                                {/* Range line */}
                                <div className="absolute left-1/2 -translate-x-0.5 w-0.5 bg-indigo-200 rounded"
                                    style={{ top: `${toY(d.max)}%`, height: `${toY(d.min) - toY(d.max)}%` }} />
                                {/* Max dot */}
                                <div className="absolute left-1/2 -translate-x-1.5 w-3 h-3 rounded-full bg-indigo-400 border-2 border-white shadow"
                                    style={{ top: `${toY(d.max)}%`, transform: 'translate(-50%, -50%)' }}
                                    title={`Max: ${formatK(d.max)}`} />
                                {/* Avg dot */}
                                <div className="absolute left-1/2 w-4 h-4 rounded-full bg-indigo-600 border-2 border-white shadow-md"
                                    style={{ top: `${toY(d.avg)}%`, transform: 'translate(-50%, -50%)' }}
                                    title={`Avg: ${formatK(d.avg)}`} />
                                {/* Min dot */}
                                <div className="absolute left-1/2 w-3 h-3 rounded-full bg-indigo-300 border-2 border-white shadow"
                                    style={{ top: `${toY(d.min)}%`, transform: 'translate(-50%, -50%)' }}
                                    title={`Min: ${formatK(d.min)}`} />
                            </div>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-2 ml-32 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" /> Avg</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-400 inline-block" /> Max</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-300 inline-block" /> Min</span>
                </div>
            </div>
        </div>
    );
}

export default function PackageInfoTab() {
    const [rawData, setRawData] = useState<BenchmarkCandidate[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [selIndustry, setSelIndustry] = useState("all");
    const [selGroup, setSelGroup] = useState("all");
    const [selJobGrouping, setSelJobGrouping] = useState("all");
    const [selJobFunction, setSelJobFunction] = useState("all");

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { candidates } = await getRawBenchmarkData();
        setRawData(candidates);
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Filter options
    const industryOptions = useMemo(() => Array.from(new Set(rawData.map(c => c.company_industry).filter(Boolean))).sort() as string[], [rawData]);
    const groupOptions = useMemo(() => Array.from(new Set(rawData.filter(c => selIndustry === "all" || c.company_industry === selIndustry).map(c => c.company_group).filter(Boolean))).sort() as string[], [rawData, selIndustry]);
    const jobGroupingOptions = useMemo(() => Array.from(new Set(rawData.map(c => c.job_grouping).filter(v => v && v !== 'NA' && v !== 'Not found exp'))).sort() as string[], [rawData]);
    const jobFunctionOptions = useMemo(() => Array.from(new Set(rawData.filter(c => selJobGrouping === "all" || c.job_grouping === selJobGrouping).map(c => c.job_function).filter(v => v && v !== 'NA' && v !== 'Not found exp'))).sort() as string[], [rawData, selJobGrouping]);

    // Filtered candidates
    const filtered = useMemo(() => rawData.filter(c => {
        if (selIndustry !== "all" && c.company_industry !== selIndustry) return false;
        if (selGroup !== "all" && c.company_group !== selGroup) return false;
        if (selJobGrouping !== "all" && c.job_grouping !== selJobGrouping) return false;
        if (selJobFunction !== "all" && c.job_function !== selJobFunction) return false;
        return true;
    }), [rawData, selIndustry, selGroup, selJobGrouping, selJobFunction]);

    // Companies sorted by avg salary (ascending)
    const companies = useMemo(() => {
        const compMap: Record<string, number[]> = {};
        filtered.forEach(c => {
            const key = c.company || "Unknown";
            const sal = parseSalary(c.gross_salary_base_b_mth);
            if (sal) {
                if (!compMap[key]) compMap[key] = [];
                compMap[key].push(sal);
            }
        });
        return Object.keys(compMap).sort((a, b) => {
            const avgA = compMap[a].reduce((s, v) => s + v, 0) / compMap[a].length;
            const avgB = compMap[b].reduce((s, v) => s + v, 0) / compMap[b].length;
            return avgA - avgB;
        });
    }, [filtered]);

    // Company salary stats
    const dataByCompany = useMemo(() => {
        const result: Record<string, { salaries: number[]; min: number; max: number; avg: number }> = {};
        companies.forEach(c => {
            const sals = filtered
                .filter(r => (r.company || "Unknown") === c)
                .map(r => parseSalary(r.gross_salary_base_b_mth))
                .filter((v): v is number => v !== null);
            if (sals.length === 0) return;
            const min = Math.min(...sals);
            const max = Math.max(...sals);
            const avg = sals.reduce((s, v) => s + v, 0) / sals.length;
            result[c] = { salaries: sals, min, max, avg };
        });
        return result;
    }, [companies, filtered]);

    // Benefits by company: for each benefit row, per company, what's the most common value
    const benefitsByCompany = useMemo(() => {
        const result: Record<string, Record<string, string | null>> = {};
        companies.forEach(company => {
            result[company] = {};
            const cands = filtered.filter(c => (c.company || "Unknown") === company);
            BENEFIT_ROWS.forEach(row => {
                const vals = cands
                    .map(c => (c as any)[row.key] as string | null)
                    .filter(v => hasBenefit(v));
                result[company][row.key] = vals.length > 0 ? (vals[0] as string) : null;
            });
        });
        return result;
    }, [companies, filtered]);

    const handleReset = () => {
        setSelIndustry("all");
        setSelGroup("all");
        setSelJobGrouping("all");
        setSelJobFunction("all");
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <span className="text-sm text-slate-400">Loading package data...</span>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header info */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    Package Information from <strong>{filtered.length}</strong> candidates
                    {companies.length > 0 && <> across <strong>{companies.length}</strong> companies</>}
                </p>
                <Button variant="outline" size="sm" onClick={fetchData} className="gap-2 text-slate-500">
                    <RefreshCw className="h-3 w-3" /> Refresh
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center p-4 bg-muted/30 rounded-lg border">
                <Select value={selIndustry} onValueChange={v => { setSelIndustry(v); setSelGroup("all"); }}>
                    <SelectTrigger className="w-[180px] text-sm"><SelectValue placeholder="Industry" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Industry</SelectItem>
                        {industryOptions.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={selGroup} onValueChange={setSelGroup} disabled={selIndustry === "all"}>
                    <SelectTrigger className="w-[200px] text-sm"><SelectValue placeholder="Company Group" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Groups</SelectItem>
                        {groupOptions.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={selJobGrouping} onValueChange={v => { setSelJobGrouping(v); setSelJobFunction("all"); }}>
                    <SelectTrigger className="w-[200px] text-sm"><SelectValue placeholder="Job Grouping" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Job Groupings</SelectItem>
                        {jobGroupingOptions.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={selJobFunction} onValueChange={setSelJobFunction} disabled={selJobGrouping === "all"}>
                    <SelectTrigger className="w-[220px] text-sm"><SelectValue placeholder="Job Function" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Functions</SelectItem>
                        {jobFunctionOptions.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={handleReset} className="gap-2 text-slate-500 hover:text-red-500">
                    <RotateCcw className="h-3 w-3" /> Reset
                </Button>
            </div>

            {companies.length === 0 ? (
                <div className="text-center py-16 text-slate-400">No data matches the selected filters</div>
            ) : (
                <>
                    {/* ══ Section 1: Gross Salary Range Chart ══ */}
                    <Card className="border shadow-sm overflow-hidden">
                        <CardHeader className="bg-slate-900 text-white py-3 px-5">
                            <CardTitle className="text-sm font-bold">
                                Gross Salary Range — {'000 THB/month'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5">
                            <SalaryDotChart companies={companies} dataByCompany={dataByCompany} />
                        </CardContent>
                    </Card>

                    {/* ══ Section 2: Benefits Table ══ */}
                    <Card className="border shadow-sm overflow-hidden">
                        <CardHeader className="bg-slate-800 text-white py-3 px-5">
                            <CardTitle className="text-sm font-bold">Benefits & Package Details</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 overflow-x-auto">
                            <table className="w-full text-xs" style={{ minWidth: `${Math.max(companies.length * 110 + 140, 500)}px` }}>
                                <thead>
                                    {/* Salary row under company header */}
                                    <tr className="bg-slate-100 border-b">
                                        <th className="text-left px-4 py-2 text-slate-600 font-bold w-36 sticky left-0 bg-slate-100 z-10">
                                            Benefit
                                        </th>
                                        {companies.map(c => {
                                            const d = dataByCompany[c];
                                            return (
                                                <th key={c} className="text-center px-2 py-2 border-l border-slate-200 font-medium text-slate-700 min-w-[100px]">
                                                    <div className="truncate max-w-[120px] mx-auto" title={c}>{c}</div>
                                                    <div className="text-indigo-600 font-bold mt-0.5">
                                                        {d ? `${formatK(d.min)}–${formatK(d.max)}` : '-'}
                                                    </div>
                                                    <div className="text-slate-400 text-[9px]">avg {d ? formatK(d.avg) : '-'}</div>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {BENEFIT_ROWS.map((row, idx) => (
                                        <tr key={row.key} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/30`}>
                                            <td className="px-4 py-2.5 font-semibold text-slate-600 sticky left-0 bg-inherit z-10 border-r border-slate-100">
                                                {row.label}
                                            </td>
                                            {companies.map(c => {
                                                const val = benefitsByCompany[c]?.[row.key] ?? null;
                                                return (
                                                    <td key={c} className="px-2 py-2.5 text-center border-l border-slate-100">
                                                        {val ? (
                                                            <span className="inline-flex items-center justify-center gap-0.5 text-emerald-700 font-medium">
                                                                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                                                <span className="text-[10px] max-w-[80px] truncate" title={val}>
                                                                    {val.length > 10 ? val.slice(0, 10) + '…' : val}
                                                                </span>
                                                            </span>
                                                        ) : (
                                                            <Minus className="w-3 h-3 text-slate-300 mx-auto" />
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>

                    {/* ══ Section 3: Candidate List ══ */}
                    <Card className="border shadow-sm overflow-hidden">
                        <CardHeader className="py-3 px-5 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-bold text-slate-700">
                                Candidate List
                                <Badge variant="secondary" className="ml-2 text-[10px]">{filtered.length}</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-auto max-h-[400px]">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-800 text-white sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-2.5 text-left font-semibold">ID</th>
                                            <th className="px-4 py-2.5 text-left font-semibold">Name</th>
                                            <th className="px-4 py-2.5 text-left font-semibold">Company</th>
                                            <th className="px-4 py-2.5 text-left font-semibold">Industry</th>
                                            <th className="px-4 py-2.5 text-left font-semibold">Job Grouping</th>
                                            <th className="px-4 py-2.5 text-right font-semibold">Gross Salary (mth)</th>
                                            <th className="px-4 py-2.5 text-center font-semibold">Bonus</th>
                                            <th className="px-4 py-2.5 text-center font-semibold">Car</th>
                                            <th className="px-4 py-2.5 text-center font-semibold">Phone</th>
                                            <th className="px-4 py-2.5 text-center font-semibold">PF%</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filtered.slice(0, 100).map((c, i) => (
                                            <tr key={c.candidate_id} className={`hover:bg-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                                <td className="px-4 py-2 font-mono text-slate-500">{c.candidate_id}</td>
                                                <td className="px-4 py-2 font-medium text-slate-800">{c.name}</td>
                                                <td className="px-4 py-2 text-slate-600 max-w-[150px] truncate" title={c.company || ''}>{c.company || '-'}</td>
                                                <td className="px-4 py-2 text-slate-500 max-w-[130px] truncate" title={c.company_industry || ''}>{c.company_industry || '-'}</td>
                                                <td className="px-4 py-2 text-slate-500">{c.job_grouping || '-'}</td>
                                                <td className="px-4 py-2 text-right font-mono text-indigo-700 font-semibold">
                                                    {c.gross_salary_base_b_mth || '-'}
                                                </td>
                                                <td className="px-4 py-2 text-center">{hasBenefit(c.bonus_mth) ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" /> : <Minus className="w-3 h-3 text-slate-200 mx-auto" />}</td>
                                                <td className="px-4 py-2 text-center">{hasBenefit(c.car_allowance_b_mth) ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" /> : <Minus className="w-3 h-3 text-slate-200 mx-auto" />}</td>
                                                <td className="px-4 py-2 text-center">{hasBenefit(c.phone_b_mth) ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" /> : <Minus className="w-3 h-3 text-slate-200 mx-auto" />}</td>
                                                <td className="px-4 py-2 text-center text-slate-600">{c.provident_fund_pct || '-'}</td>
                                            </tr>
                                        ))}
                                        {filtered.length > 100 && (
                                            <tr><td colSpan={10} className="px-4 py-3 text-center text-slate-400 text-[11px]">
                                                Showing 100 of {filtered.length} — apply filters to narrow down
                                            </td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
