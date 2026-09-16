"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart, Bar, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Info, Loader2, RefreshCw } from "lucide-react";
import { getRawBenchmarkData, type BenchmarkCandidate } from "@/app/actions/benchmark-actions";
import { parseSalary } from "@/lib/benchmark-utils";
import { buildSalaryHistogram, buildSalaryStats, percentileRank, statsByGroup } from "@/lib/salary-stats";
import { BenchmarkFilterBar, useBenchmarkFilters } from "./benchmark-filters";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Market-wide salary benchmark: every candidate in the database with a basic salary on file,
 * narrowed by the same filters as the rest of the dashboard.
 *
 * The JR tab of the same name deliberately looks only at that JR's own shortlist. This is the
 * other question — what the wider pool pays — and it lives here because answering it well needs
 * filters across industry, company and position rather than one requisition's candidates.
 */

const thb = (n: number | null | undefined) =>
    n === null || n === undefined || !isFinite(n) ? "—" : `฿${Math.round(n).toLocaleString()}`;

const thbShort = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(Math.round(n));

const GLOSSARY: { term: string; meaning: string }[] = [
    {
        term: "Which candidates",
        meaning: "Everyone in our database with a gross basic salary on their profile, narrowed by the filters above. Not a published survey — this is our own data.",
    },
    { term: "Median", meaning: "The middle salary: half earn more, half earn less. Used instead of an average so outliers can't drag it." },
    { term: "P25 – P75", meaning: "The middle half of the group. A quarter earn below P25, a quarter above P75." },
    { term: "Compare a figure", meaning: "Type any monthly salary to see where it would sit in the filtered group, as a percentile." },
    { term: "n", meaning: "How many candidates a figure is built from. Breakdown rows need at least 3." },
    { term: "Basic salary only", meaning: "Monthly basic salary in THB. Bonus is listed separately in months and never folded in." },
];

function SummaryCard({ label, value, sub, tone = "slate" }: {
    label: string; value: string; sub?: string; tone?: "slate" | "indigo" | "emerald";
}) {
    const tones = { slate: "text-slate-900 dark:text-white", indigo: "text-indigo-600", emerald: "text-emerald-600" };
    return (
        <Card className="border-slate-200">
            <CardContent className="p-4">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</div>
                <div className={cn("text-xl font-black mt-1 leading-none", tones[tone])}>{value}</div>
                {sub && <div className="text-[11px] font-medium text-slate-400 mt-1">{sub}</div>}
            </CardContent>
        </Card>
    );
}

function BreakdownTable({ title, keyLabel, rows }: {
    title: string; keyLabel: string; rows: ReturnType<typeof statsByGroup>;
}) {
    if (rows.length === 0) return null;
    return (
        <Card className="border-slate-200">
            <CardContent className="p-0">
                <div className="px-4 py-3 border-b border-slate-100 text-[11px] font-black uppercase tracking-wider text-slate-500">
                    {title}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                            <tr>
                                <th className="px-4 py-2 text-left">{keyLabel}</th>
                                <th className="px-4 py-2 text-right">Median</th>
                                <th className="px-4 py-2 text-right">P25</th>
                                <th className="px-4 py-2 text-right">P75</th>
                                <th className="px-4 py-2 text-right">n</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rows.slice(0, 12).map(r => (
                                <tr key={r.key} className="hover:bg-slate-50/60">
                                    <td className="px-4 py-2 font-bold text-slate-700 max-w-[260px] truncate" title={r.key}>{r.key}</td>
                                    <td className="px-4 py-2 text-right font-black text-slate-800">{thb(r.median)}</td>
                                    <td className="px-4 py-2 text-right text-slate-500">{thb(r.p25)}</td>
                                    <td className="px-4 py-2 text-right text-slate-500">{thb(r.p75)}</td>
                                    <td className="px-4 py-2 text-right text-slate-400 font-bold">{r.n}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}

export default function SalaryBenchmarkTab() {
    const [rawData, setRawData] = useState<BenchmarkCandidate[]>([]);
    const [loading, setLoading] = useState(true);
    const [showGlossary, setShowGlossary] = useState(false);
    const [compareInput, setCompareInput] = useState("");

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { candidates } = await getRawBenchmarkData();
        setRawData(candidates);
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filters = useBenchmarkFilters(rawData);
    const rows = filters.filtered;

    const values = useMemo(
        () => rows.map(c => parseSalary(c.gross_salary_base_b_mth)).filter((v): v is number => v !== null && v > 0).sort((a, b) => a - b),
        [rows]
    );
    const stats = useMemo(() => buildSalaryStats(values), [values]);
    const histogram = useMemo(() => buildSalaryHistogram(values), [values]);

    const compareValue = compareInput.trim() ? Number(compareInput.replace(/[^0-9.]/g, "")) : null;
    const comparePercentile = compareValue && stats ? percentileRank(values, compareValue) : null;

    const amount = (c: BenchmarkCandidate) => parseSalary(c.gross_salary_base_b_mth) ?? 0;
    const byRating = useMemo(() => statsByGroup(rows, c => c.rating, amount), [rows]);
    const byIndustry = useMemo(() => statsByGroup(rows, c => c.company_industry, amount), [rows]);
    const byCompany = useMemo(() => statsByGroup(rows, c => c.company, amount), [rows]);
    const byJobFunction = useMemo(() => statsByGroup(rows, c => c.job_function, amount), [rows]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading salary data...
            </div>
        );
    }

    const pct = (v: number) => {
        if (!stats) return 0;
        const span = Math.max(stats.max - stats.min, 1);
        return Math.min(100, Math.max(0, ((v - stats.min) / span) * 100));
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm text-muted-foreground">
                    Salary benchmark from <strong>{values.length}</strong> candidates with a basic salary on file
                    {rows.length !== values.length && <> (of <strong>{rows.length}</strong> matching the filters)</>}
                </p>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowGlossary(v => !v)} aria-expanded={showGlossary}>
                        <Info className="h-3 w-3" /> What the numbers mean
                    </Button>
                    <Button variant="outline" size="sm" onClick={fetchData} className="gap-2 text-slate-500">
                        <RefreshCw className="h-3 w-3" /> Refresh
                    </Button>
                </div>
            </div>

            {showGlossary && (
                <Card className="border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/20">
                    <CardContent className="p-4">
                        <dl className="grid grid-cols-1 md:grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
                            {GLOSSARY.map(g => (
                                <div key={g.term} className="contents">
                                    <dt className="text-[11px] font-black text-indigo-700 dark:text-indigo-300 whitespace-nowrap">{g.term}</dt>
                                    <dd className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-1.5 md:mb-0">{g.meaning}</dd>
                                </div>
                            ))}
                        </dl>
                    </CardContent>
                </Card>
            )}

            <BenchmarkFilterBar filters={filters} />

            {!stats ? (
                <Card className="border-dashed">
                    <CardContent className="py-16 text-center space-y-1">
                        <p className="text-sm font-bold text-slate-600">No salary data matches these filters</p>
                        <p className="text-xs text-slate-400">Loosen a filter, or fill in &quot;Base Salary (Gross)&quot; on more candidate profiles.</p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        <SummaryCard label="Median" value={thb(stats.median)} sub="per month" />
                        <SummaryCard label="Range (P25–P75)" value={`${thbShort(stats.p25)} – ${thbShort(stats.p75)}`} sub="middle 50%" />
                        <SummaryCard label="Min – Max" value={`${thbShort(stats.min)} – ${thbShort(stats.max)}`} sub={`n = ${stats.n}`} />
                        <Card className="border-slate-200">
                            <CardContent className="p-4">
                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Compare a figure</div>
                                <Input
                                    id="salary-compare"
                                    value={compareInput}
                                    onChange={e => setCompareInput(e.target.value)}
                                    placeholder="e.g. 120000"
                                    inputMode="numeric"
                                    className="h-8 mt-1.5 text-sm"
                                />
                            </CardContent>
                        </Card>
                        <SummaryCard
                            label="That figure sits at"
                            value={comparePercentile !== null ? `P${comparePercentile}` : "—"}
                            sub={comparePercentile !== null ? `${100 - comparePercentile}% earn more` : "type a figure to see"}
                            tone={comparePercentile === null ? "slate" : comparePercentile < 50 ? "slate" : "emerald"}
                        />
                    </div>

                    <Card className="border-slate-200">
                        <CardContent className="p-6">
                            <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">Salary Positioning</div>
                            <p className="text-[11px] text-slate-400 font-medium mt-1">Spread of the filtered group, with your figure marked</p>

                            <div className="pt-10 pb-10 px-2">
                                <div className="relative h-12">
                                    <div className="absolute inset-x-0 top-4 h-4 rounded bg-slate-100" />
                                    <div
                                        className="absolute top-4 h-4 rounded bg-indigo-200"
                                        style={{ left: `${pct(stats.p25)}%`, width: `${Math.max(pct(stats.p75) - pct(stats.p25), 0.5)}%` }}
                                    />
                                    <div className="absolute top-2 h-8 w-0.5 bg-indigo-700" style={{ left: `${pct(stats.median)}%` }} />
                                    <div className="absolute -top-5 text-[10px] font-black text-indigo-700 -translate-x-1/2 whitespace-nowrap" style={{ left: `${pct(stats.median)}%` }}>
                                        Median {thbShort(stats.median)}
                                    </div>
                                    <div className="absolute top-2 h-8 w-0.5 bg-slate-400" style={{ left: 0 }} />
                                    <div className="absolute top-2 h-8 w-0.5 bg-slate-400" style={{ right: 0 }} />
                                    <div className="absolute top-14 text-[10px] font-bold text-slate-400" style={{ left: 0 }}>Min {thbShort(stats.min)}</div>
                                    <div className="absolute top-14 text-[10px] font-bold text-slate-400" style={{ right: 0 }}>Max {thbShort(stats.max)}</div>
                                    <div className="absolute top-14 text-[10px] font-bold text-indigo-400 -translate-x-1/2" style={{ left: `${pct(stats.p25)}%` }}>P25 {thbShort(stats.p25)}</div>
                                    <div className="absolute top-14 text-[10px] font-bold text-indigo-400 -translate-x-1/2" style={{ left: `${pct(stats.p75)}%` }}>P75 {thbShort(stats.p75)}</div>

                                    {compareValue !== null && compareValue > 0 && (
                                        <>
                                            <div
                                                className="absolute top-4 h-4 w-4 rounded-full border-2 border-white shadow -translate-x-1/2 bg-emerald-500"
                                                style={{ left: `${pct(compareValue)}%` }}
                                            />
                                            <div
                                                className="absolute -top-10 text-[10px] font-black text-emerald-600 -translate-x-1/2 whitespace-nowrap"
                                                style={{ left: `${pct(compareValue)}%` }}
                                            >
                                                Your figure<br />{thbShort(compareValue)}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {histogram.length > 0 && (
                        <Card className="border-slate-200">
                            <CardContent className="p-4">
                                <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
                                    Salary Distribution <span className="font-medium normal-case tracking-normal text-slate-400">— how many candidates sit in each band</span>
                                </div>
                                <div style={{ height: 260 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={histogram.map(b => ({ ...b, label: thbShort(b.start) }))} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                                            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
                                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} label={{ value: "candidates", angle: -90, position: "insideLeft", fontSize: 10, fill: "#94a3b8" }} />
                                            <Tooltip
                                                cursor={{ fill: "rgba(99,102,241,0.06)" }}
                                                content={({ active, payload }) => {
                                                    if (!active || !payload?.length) return null;
                                                    const b = payload[0].payload;
                                                    return (
                                                        <div className="bg-slate-900 text-white text-xs rounded px-2 py-1 shadow-xl">
                                                            <div className="font-bold">{thb(b.start)} – {thb(b.end)}</div>
                                                            <div>{b.count} candidate{b.count === 1 ? "" : "s"}</div>
                                                        </div>
                                                    );
                                                }}
                                            />
                                            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                                {histogram.map((b, i) => {
                                                    const inBand = compareValue !== null && compareValue >= b.start && compareValue < b.end;
                                                    return <Cell key={i} fill={inBand ? "#10b981" : "#a5b4fc"} />;
                                                })}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <BreakdownTable title="Median by Hotel Star Rating" keyLabel="Star Rating" rows={byRating} />
                        <BreakdownTable title="Median by Industry" keyLabel="Industry" rows={byIndustry} />
                        <BreakdownTable title="Median by Job Function" keyLabel="Job Function" rows={byJobFunction} />
                        <BreakdownTable title="Median by Company — top 12" keyLabel="Company" rows={byCompany} />
                    </div>

                    <p className="text-[10px] text-slate-400 font-medium">
                        Source: candidate profiles in our own database. This is internal data, not a published salary survey —
                        a group needs at least 3 candidates before it appears in a breakdown.
                    </p>
                </>
            )}
        </div>
    );
}
