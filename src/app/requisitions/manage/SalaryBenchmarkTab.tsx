"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Banknote, Info, Loader2, Pencil, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { formatDateForDisplay } from "@/lib/date-utils";
import { getJRSalaryBenchmark, updateJRBudget, type JRSalaryBenchmark } from "@/app/actions/jr-salary-benchmark";

const thb = (n: number | null | undefined) =>
    n === null || n === undefined || !isFinite(n) ? "—" : `฿${Math.round(n).toLocaleString()}`;

const thbShort = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(Math.round(n));

function SummaryCard({ label, value, sub, tone = "slate" }: {
    label: string; value: string; sub?: string; tone?: "slate" | "indigo" | "amber" | "red" | "emerald";
}) {
    const tones = {
        slate: "text-slate-900 dark:text-white",
        indigo: "text-indigo-600",
        amber: "text-amber-600",
        red: "text-red-600",
        emerald: "text-emerald-600",
    };
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

/**
 * Where the budget sits against the market spread. Positions are percentages of the min–max
 * range, so the bar stays honest whatever the absolute numbers are.
 */
function PositioningBar({ data }: { data: JRSalaryBenchmark }) {
    const m = data.market;
    if (!m) return null;

    const span = Math.max(m.max - m.min, 1);
    const pct = (v: number) => Math.min(100, Math.max(0, ((v - m.min) / span) * 100));

    const budgetPoint = data.budget
        ? (data.budget.min && data.budget.max ? (data.budget.min + data.budget.max) / 2 : data.budget.min || data.budget.max)
        : null;
    const budgetBelowRange = budgetPoint !== null && budgetPoint < m.p25;

    return (
        <div className="pt-10 pb-8 px-2">
            <div className="relative h-12">
                {/* full min–max track */}
                <div className="absolute inset-x-0 top-4 h-4 rounded bg-slate-100" />
                {/* P25–P75 band */}
                <div
                    className="absolute top-4 h-4 rounded bg-indigo-200"
                    style={{ left: `${pct(m.p25)}%`, width: `${Math.max(pct(m.p75) - pct(m.p25), 0.5)}%` }}
                />
                {/* median */}
                <div className="absolute top-2 h-8 w-0.5 bg-indigo-700" style={{ left: `${pct(m.median)}%` }} />
                <div
                    className="absolute -top-5 text-[10px] font-black text-indigo-700 -translate-x-1/2 whitespace-nowrap"
                    style={{ left: `${pct(m.median)}%` }}
                >
                    Median {thbShort(m.median)}
                </div>
                {/* min / max caps */}
                <div className="absolute top-2 h-8 w-0.5 bg-slate-400" style={{ left: 0 }} />
                <div className="absolute top-2 h-8 w-0.5 bg-slate-400" style={{ right: 0 }} />
                <div className="absolute top-14 text-[10px] font-bold text-slate-400" style={{ left: 0 }}>
                    Min {thbShort(m.min)}
                </div>
                <div className="absolute top-14 text-[10px] font-bold text-slate-400" style={{ right: 0 }}>
                    Max {thbShort(m.max)}
                </div>
                <div
                    className="absolute top-14 text-[10px] font-bold text-indigo-400 -translate-x-1/2"
                    style={{ left: `${pct(m.p25)}%` }}
                >
                    P25 {thbShort(m.p25)}
                </div>
                <div
                    className="absolute top-14 text-[10px] font-bold text-indigo-400 -translate-x-1/2"
                    style={{ left: `${pct(m.p75)}%` }}
                >
                    P75 {thbShort(m.p75)}
                </div>

                {/* budget */}
                {budgetPoint !== null && (
                    <>
                        {data.budget?.min && data.budget?.max && (
                            <div
                                className={cn("absolute top-5 h-2 rounded-full opacity-70", budgetBelowRange ? "bg-red-400" : "bg-emerald-400")}
                                style={{
                                    left: `${pct(data.budget.min)}%`,
                                    width: `${Math.max(pct(data.budget.max) - pct(data.budget.min), 0.5)}%`,
                                }}
                            />
                        )}
                        <div
                            className={cn(
                                "absolute top-4 h-4 w-4 rounded-full border-2 border-white shadow -translate-x-1/2",
                                budgetBelowRange ? "bg-red-500" : "bg-emerald-500"
                            )}
                            style={{ left: `${pct(budgetPoint)}%` }}
                        />
                        <div
                            className={cn(
                                "absolute -top-10 text-[10px] font-black -translate-x-1/2 whitespace-nowrap",
                                budgetBelowRange ? "text-red-600" : "text-emerald-600"
                            )}
                            style={{ left: `${pct(budgetPoint)}%` }}
                        >
                            Our Budget
                            <br />
                            {thbShort(budgetPoint)}
                        </div>
                    </>
                )}
            </div>

            <div className="flex items-center gap-4 mt-12 text-[10px] font-bold text-slate-400">
                <span className="flex items-center gap-1"><span className="h-2 w-4 rounded bg-indigo-200" /> Market range (P25–P75)</span>
                <span className="flex items-center gap-1"><span className="h-3 w-0.5 bg-indigo-700" /> Median</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Our budget</span>
            </div>
        </div>
    );
}

function SegmentTable({ title, rows, keyLabel }: { title: string; rows: JRSalaryBenchmark["byHotelRating"]; keyLabel: string }) {
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
                                <th className="px-4 py-2 text-right">Sample</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rows.map(r => (
                                <tr key={r.key} className="hover:bg-slate-50/60">
                                    <td className="px-4 py-2 font-bold text-slate-700">{r.key}</td>
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

function BudgetDialog({ open, onOpenChange, data, onSaved }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    data: JRSalaryBenchmark;
    onSaved: () => void | Promise<void>;
}) {
    const [min, setMin] = useState("");
    const [max, setMax] = useState("");
    const [note, setNote] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setMin(data.budget?.min ? String(data.budget.min) : "");
        setMax(data.budget?.max ? String(data.budget.max) : "");
        setNote(data.budget?.note || "");
    }, [open, data.budget]);

    const save = async () => {
        const minValue = min.trim() ? Number(min.replace(/[^0-9.]/g, "")) : null;
        const maxValue = max.trim() ? Number(max.replace(/[^0-9.]/g, "")) : null;
        if (minValue !== null && maxValue !== null && maxValue < minValue) {
            toast.error("Maximum budget cannot be lower than the minimum.");
            return;
        }
        setSaving(true);
        const res = await updateJRBudget(data.jrId, { min: minValue, max: maxValue, note: note.trim() || null });
        if (res.success) {
            toast.success("Budget saved");
            await onSaved();
            onOpenChange(false);
        } else {
            toast.error(res.error || "Failed to save budget");
        }
        setSaving(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[440px]">
                <DialogHeader>
                    <DialogTitle className="font-black">Salary Budget</DialogTitle>
                    <DialogDescription>
                        Monthly basic salary in THB — the same basis as the market figures on this tab.
                        Leave the maximum empty if the budget is a single figure.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold">Budget (min)</Label>
                            <Input value={min} onChange={e => setMin(e.target.value)} placeholder="100000" inputMode="numeric" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold">Budget (max)</Label>
                            <Input value={max} onChange={e => setMax(e.target.value)} placeholder="optional" inputMode="numeric" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Note</Label>
                        <Textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Approval reference, package notes..." />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
                    <Button onClick={save} disabled={saving} className="gap-2">
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        Save budget
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function SalaryBenchmarkTab({ jrId }: { jrId: string }) {
    const [data, setData] = useState<JRSalaryBenchmark | null>(null);
    const [loading, setLoading] = useState(true);
    const [budgetOpen, setBudgetOpen] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setData(await getJRSalaryBenchmark(jrId));
        } catch (e) {
            console.error("Failed to load salary benchmark", e);
        } finally {
            setLoading(false);
        }
    }, [jrId]);

    useEffect(() => { load(); }, [load]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading salary benchmark...
            </div>
        );
    }

    if (!data) {
        return (
            <Card className="border-dashed">
                <CardContent className="py-12 text-center text-sm font-bold text-slate-500">
                    Could not load salary data for this JR.
                </CardContent>
            </Card>
        );
    }

    const m = data.market;
    const budgetPoint = data.budget
        ? (data.budget.min && data.budget.max ? (data.budget.min + data.budget.max) / 2 : data.budget.min || data.budget.max)
        : null;

    const budgetLabel = data.budget
        ? data.budget.min && data.budget.max
            ? `${thb(data.budget.min)} – ${thb(data.budget.max)}`
            : thb(data.budget.min || data.budget.max)
        : "Not set";

    const gapTone = data.budgetVsMedianPct === null ? "slate" : data.budgetVsMedianPct < -10 ? "red" : data.budgetVsMedianPct < 0 ? "amber" : "emerald";

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Salary Benchmark</h3>
                    <p className="text-xs text-slate-400 font-medium max-w-2xl">
                        Monthly basic salary (THB). Market figures come from candidate profiles in our own database whose
                        current role matches this position{data.cohortKeywords.length > 0 && <> — matched on <span className="font-bold text-slate-500">{data.cohortKeywords.join(", ")}</span></>}.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2" onClick={load}>
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh
                    </Button>
                    <Button size="sm" className="gap-2" onClick={() => setBudgetOpen(true)}>
                        <Pencil className="h-3.5 w-3.5" /> {data.budget ? "Edit budget" : "Set budget"}
                    </Button>
                </div>
            </div>

            {data.dataQuality.budgetColumnsMissing && (
                <Card className="border-amber-200 bg-amber-50/60">
                    <CardContent className="p-3 text-xs font-bold text-amber-800 flex items-start gap-2">
                        <Info className="h-4 w-4 shrink-0 mt-0.5" />
                        Budget storage is not in the database yet — apply migration
                        <code className="font-mono">20260916000000_add_jr_budget_and_stage_owner.sql</code>
                        before setting a budget.
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <SummaryCard label="Market Median" value={m ? thb(m.median) : "—"} sub="per month" />
                <SummaryCard label="Market Range (P25–P75)" value={m ? `${thbShort(m.p25)} – ${thbShort(m.p75)}` : "—"} sub="middle 50%" />
                <SummaryCard label="Market Min – Max" value={m ? `${thbShort(m.min)} – ${thbShort(m.max)}` : "—"} sub={m ? `n = ${m.n}` : undefined} />
                <SummaryCard
                    label="Our Budget"
                    value={budgetLabel}
                    sub={data.budgetVsMedianPct !== null
                        ? `${data.budgetVsMedianPct > 0 ? "+" : ""}${data.budgetVsMedianPct}% vs median`
                        : "not set"}
                    tone={gapTone as any}
                />
                <SummaryCard
                    label="Budget Position"
                    value={data.budgetPercentile !== null ? `P${data.budgetPercentile}` : "—"}
                    sub={data.budgetPercentile !== null ? "percentile of market" : "set a budget to see"}
                    tone={data.budgetPercentile === null ? "slate" : data.budgetPercentile < 25 ? "red" : data.budgetPercentile < 50 ? "amber" : "emerald"}
                />
            </div>

            {m ? (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                    <Card className="border-slate-200 xl:col-span-2">
                        <CardContent className="p-4">
                            <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">Salary Positioning</div>
                            <PositioningBar data={data} />
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200">
                        <CardContent className="p-4 space-y-3">
                            <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">What this means</div>
                            {budgetPoint === null ? (
                                <p className="text-xs font-medium text-slate-500">
                                    Set a budget to see how it compares with what these candidates currently earn.
                                </p>
                            ) : (
                                <>
                                    <div className={cn(
                                        "rounded-xl p-3 text-xs font-bold flex items-start gap-2",
                                        (data.budgetVsMedianPct ?? 0) < 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"
                                    )}>
                                        {(data.budgetVsMedianPct ?? 0) < 0
                                            ? <TrendingDown className="h-4 w-4 shrink-0 mt-0.5" />
                                            : <TrendingUp className="h-4 w-4 shrink-0 mt-0.5" />}
                                        <span>
                                            Budget {thb(budgetPoint)} sits at the {data.budgetPercentile}th percentile
                                            {data.budgetVsMedianPct !== null && (
                                                <> — {Math.abs(data.budgetVsMedianPct)}% {data.budgetVsMedianPct < 0 ? "below" : "above"} the median for this role</>
                                            )}.
                                        </span>
                                    </div>
                                    <ul className="text-xs font-medium text-slate-600 space-y-1.5 list-disc pl-4">
                                        {(data.budgetPercentile ?? 50) < 25 && (
                                            <li>Roughly {100 - (data.budgetPercentile ?? 0)}% of matching candidates already earn more than this budget — expect a narrow pool.</li>
                                        )}
                                        {(data.budgetPercentile ?? 50) < 50 && (
                                            <li>Consider what can close the gap without moving base: bonus months, housing, transport.</li>
                                        )}
                                        {(data.budgetPercentile ?? 50) >= 50 && (
                                            <li>Budget is at or above the median — competitive for this pool.</li>
                                        )}
                                        {data.pipeline && (
                                            <li>
                                                Candidates already in this JR: median {thb(data.pipeline.median)} ({data.pipeline.n} with salary on file).
                                            </li>
                                        )}
                                    </ul>
                                    {data.budget?.note && (
                                        <p className="text-[11px] text-slate-400 italic border-t border-slate-100 pt-2">{data.budget.note}</p>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <Card className="border-dashed">
                    <CardContent className="py-10 text-center space-y-1">
                        <Banknote className="h-7 w-7 text-slate-300 mx-auto" />
                        <p className="text-sm font-bold text-slate-600">Not enough salary data for this position yet</p>
                        <p className="text-xs text-slate-400 max-w-md mx-auto">
                            Market figures need candidates whose current role matches this position and who have
                            &quot;Gross Salary Base&quot; filled in on their profile.
                            {data.cohortKeywords.length === 0 && " No position keyword matched this JR title."}
                        </p>
                    </CardContent>
                </Card>
            )}

            {data.histogram.length > 0 && (
                <Card className="border-slate-200">
                    <CardContent className="p-4">
                        <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
                            Salary Distribution <span className="font-medium normal-case tracking-normal text-slate-400">— how many matching candidates sit in each band</span>
                        </div>
                        <div style={{ height: 240 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.histogram.map(b => ({ ...b, label: thbShort(b.start) }))} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
                                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
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
                                        {data.histogram.map((b, i) => {
                                            const inBudget = budgetPoint !== null && budgetPoint >= b.start && budgetPoint < b.end;
                                            return <Cell key={i} fill={inBudget ? "#10b981" : "#a5b4fc"} />;
                                        })}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        {budgetPoint !== null && (
                            <div className="text-[10px] font-bold text-slate-400 mt-1">
                                <span className="inline-block h-2 w-3 rounded bg-emerald-500 mr-1 align-middle" />
                                band containing our budget
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <SegmentTable title="Market Salary by Hotel Star Rating" rows={data.byHotelRating} keyLabel="Star Rating" />
                <SegmentTable title="Market Salary by Region" rows={data.byRegion} keyLabel="Region" />
            </div>

            {data.pipelineRows.length > 0 && (
                <Card className="border-slate-200">
                    <CardContent className="p-0">
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                                Candidates in this JR ({data.dataQuality.pipelineWithSalary} of {data.dataQuality.pipelineTotal} have salary on file)
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Candidate</th>
                                        <th className="px-4 py-2 text-left">Current Company</th>
                                        <th className="px-4 py-2 text-left">Rating</th>
                                        <th className="px-4 py-2 text-right">Monthly Base</th>
                                        <th className="px-4 py-2 text-right">Bonus (mth)</th>
                                        <th className="px-4 py-2 text-right">vs Budget</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {data.pipelineRows.map(r => {
                                        const diff = budgetPoint && r.monthlyBase > 0 ? r.monthlyBase - budgetPoint : null;
                                        return (
                                            <tr key={r.candidateId} className="hover:bg-slate-50/60">
                                                <td className="px-4 py-2 font-bold text-slate-800">{r.name}</td>
                                                <td className="px-4 py-2 text-slate-500 text-xs">{r.company || "—"}</td>
                                                <td className="px-4 py-2 text-slate-500 text-xs">{r.hotelRating || "—"}</td>
                                                <td className="px-4 py-2 text-right font-black text-slate-800">
                                                    {r.monthlyBase > 0 ? thb(r.monthlyBase) : <span className="text-slate-300 italic font-bold text-xs">No data</span>}
                                                </td>
                                                <td className="px-4 py-2 text-right text-slate-500">{r.bonusMonths > 0 ? r.bonusMonths : "—"}</td>
                                                <td className={cn(
                                                    "px-4 py-2 text-right font-bold",
                                                    diff === null ? "text-slate-300" : diff > 0 ? "text-red-600" : "text-emerald-600"
                                                )}>
                                                    {diff === null ? "—" : `${diff > 0 ? "+" : ""}${thb(diff)}`}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-4 py-2 border-t border-slate-100 text-[10px] text-slate-400 font-medium">
                            &quot;vs Budget&quot; compares each candidate&apos;s current basic salary with the budget midpoint — positive means they earn more than the budget today.
                        </div>
                    </CardContent>
                </Card>
            )}

            {data.placements.length > 0 && (
                <Card className="border-slate-200">
                    <CardContent className="p-0">
                        <div className="px-4 py-3 border-b border-slate-100 text-[11px] font-black uppercase tracking-wider text-slate-500">
                            What we actually paid — recent placements for similar positions
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Candidate</th>
                                        <th className="px-4 py-2 text-left">Position</th>
                                        <th className="px-4 py-2 text-left">BU</th>
                                        <th className="px-4 py-2 text-left">Hire Date</th>
                                        <th className="px-4 py-2 text-right">Monthly Base</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {data.placements.map((p, i) => (
                                        <tr key={i} className="hover:bg-slate-50/60">
                                            <td className="px-4 py-2 font-bold text-slate-800">{p.candidateName}</td>
                                            <td className="px-4 py-2 text-slate-500 text-xs">{p.position || "—"}</td>
                                            <td className="px-4 py-2 text-slate-500 text-xs">{p.bu || "—"}</td>
                                            <td className="px-4 py-2 text-slate-500 text-xs">{p.hireDate ? formatDateForDisplay(p.hireDate) : "—"}</td>
                                            <td className="px-4 py-2 text-right font-black text-slate-800">{thb(p.monthlyBase)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            <p className="text-[10px] text-slate-400 font-medium">
                Source: candidate profiles ({data.dataQuality.marketSampleSize} with salary on file) and our own placement records.
                This is internal data, not a published salary survey.
            </p>

            <BudgetDialog open={budgetOpen} onOpenChange={setBudgetOpen} data={data} onSaved={load} />
        </div>
    );
}
