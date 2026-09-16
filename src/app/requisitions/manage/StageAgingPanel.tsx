"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ChevronRight, Clock, Loader2, RefreshCw, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateForDisplay } from "@/lib/date-utils";
import { getJRStageAging, type JRStageAging } from "@/app/actions/jr-stage-aging";
import { SEVERITY_LABEL, STAGE_THRESHOLDS, type StageSeverity } from "@/lib/stage-aging";

const SEVERITY_STYLES: Record<StageSeverity, { pill: string; card: string; dot: string }> = {
    ok: { pill: "bg-emerald-50 text-emerald-700 border-emerald-200", card: "border-slate-200", dot: "bg-emerald-500" },
    attention: { pill: "bg-amber-50 text-amber-700 border-amber-200", card: "border-amber-200 bg-amber-50/30", dot: "bg-amber-500" },
    delayed: { pill: "bg-orange-50 text-orange-700 border-orange-200", card: "border-orange-200 bg-orange-50/40", dot: "bg-orange-500" },
    critical: { pill: "bg-red-50 text-red-700 border-red-200", card: "border-red-300 bg-red-50/50", dot: "bg-red-500" },
};

function StatCard({ label, value, hint, icon: Icon, tone = "slate" }: {
    label: string; value: string | number; hint?: string; icon: any; tone?: "slate" | "amber" | "red" | "indigo";
}) {
    const tones = {
        slate: "bg-slate-100 text-slate-600",
        amber: "bg-amber-100 text-amber-600",
        red: "bg-red-100 text-red-600",
        indigo: "bg-indigo-100 text-indigo-600",
    };
    return (
        <Card className="border-slate-200">
            <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("p-2.5 rounded-xl shrink-0", tones[tone])}>
                    <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                    <div className="text-2xl font-black text-slate-900 dark:text-white leading-none">{value}</div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-1">{label}</div>
                    {hint && <div className="text-[11px] text-slate-400 font-medium truncate">{hint}</div>}
                </div>
            </CardContent>
        </Card>
    );
}

export function StageAgingPanel({ jrId }: { jrId: string }) {
    const [data, setData] = useState<JRStageAging | null>(null);
    const [loading, setLoading] = useState(true);
    const [showDone, setShowDone] = useState(false);

    const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
        if (!silent) setLoading(true);
        try {
            setData(await getJRStageAging(jrId));
        } catch (e) {
            console.error("Failed to load stage aging", e);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [jrId]);

    useEffect(() => { load(); }, [load]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading stage aging...
            </div>
        );
    }

    if (!data || data.candidates.length === 0) {
        return (
            <Card className="border-dashed">
                <CardContent className="py-12 text-center space-y-1">
                    <p className="text-sm font-bold text-slate-600">No candidates in this JR yet</p>
                    <p className="text-xs text-slate-400">Stage aging appears once candidates are added and their status starts moving.</p>
                </CardContent>
            </Card>
        );
    }

    // Stages nobody has ever touched would just be noise between the ones that matter.
    const visibleStages = data.stages.filter(s => s.currentCount > 0 || s.visits > 0);
    const visibleCandidates = showDone ? data.candidates : data.candidates.filter(c => !c.isTerminal);
    const longestWait = data.candidates.filter(c => !c.isTerminal).reduce((m, c) => Math.max(m, c.agingDays), 0);
    const doneCount = data.candidates.length - data.candidates.filter(c => !c.isTerminal).length;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Stage Aging &amp; Bottleneck</h3>
                    <p className="text-xs text-slate-400 font-medium">Where the search is waiting right now — measured from each candidate&apos;s latest status change.</p>
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => load()}>
                    <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Total Open Days" value={data.totalOpenDays ?? "—"} icon={Clock} tone="indigo" />
                <StatCard label="Active Candidates" value={data.activeCandidates} hint={doneCount > 0 ? `${doneCount} finished` : undefined} icon={Users} />
                <StatCard
                    label="Longest Wait"
                    value={`${longestWait}d`}
                    icon={AlertCircle}
                    tone={longestWait >= STAGE_THRESHOLDS.delayed ? "red" : longestWait >= STAGE_THRESHOLDS.attention ? "amber" : "slate"}
                />
                <StatCard
                    label="Stages In Play"
                    value={visibleStages.filter(s => s.currentCount > 0 && !s.isTerminal).length}
                    icon={ChevronRight}
                />
            </div>

            {data.ownerRoleConfigured && data.ownerDays.length > 0 && (
                <Card className="border-slate-200">
                    <CardContent className="p-4">
                        <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-3">Waiting Days by Owner</div>
                        <div className="flex flex-wrap gap-4">
                            {data.ownerDays.map(o => (
                                <div key={o.ownerRole} className="flex items-baseline gap-2">
                                    <span className="text-xl font-black text-slate-900 dark:text-white">{o.days}d</span>
                                    <span className="text-xs font-bold text-slate-500">{o.ownerRole}</span>
                                    <span className="text-[11px] text-slate-400">({o.candidates})</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {data.bottleneck ? (
                <Card className="border-red-200 bg-red-50/60">
                    <CardContent className="p-5 flex items-start gap-4">
                        <div className="p-2.5 rounded-full bg-red-100 text-red-600 shrink-0">
                            <AlertCircle className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-black uppercase tracking-widest text-red-600">Current Bottleneck</div>
                            <div className="text-xl font-black text-slate-900 dark:text-white leading-tight mt-0.5">{data.bottleneck.status}</div>
                            <div className="text-xs font-bold text-slate-600 mt-1">
                                {data.bottleneck.waitingCount} candidate{data.bottleneck.waitingCount === 1 ? "" : "s"} waiting
                                <span className="mx-2 text-slate-300">|</span>
                                Oldest wait: {data.bottleneck.longestWaitDays} days
                                {data.bottleneck.ownerRole && (
                                    <>
                                        <span className="mx-2 text-slate-300">|</span>
                                        Owner: {data.bottleneck.ownerRole}
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                            <div className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-3 py-1 text-xs font-black">
                                Longest wait: {data.bottleneck.longestWaitDays} days
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-emerald-200 bg-emerald-50/50">
                    <CardContent className="p-4 text-sm font-bold text-emerald-800">
                        No stage is holding this search up — every active candidate has moved within the last {STAGE_THRESHOLDS.attention} days.
                    </CardContent>
                </Card>
            )}

            {/* Stage strip */}
            <Card className="border-slate-200">
                <CardContent className="p-4">
                    <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-3">Stage Flow</div>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {visibleStages.map((s, i) => {
                            const style = SEVERITY_STYLES[s.severity];
                            return (
                                <div key={s.status} className="flex items-center gap-2 shrink-0">
                                    <div className={cn("rounded-xl border p-3 w-[190px] bg-white dark:bg-slate-900", style.card)}>
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="h-5 w-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black flex items-center justify-center shrink-0">
                                                {i + 1}
                                            </span>
                                            <span className="text-[11px] font-bold text-slate-600 leading-tight line-clamp-2">{s.status}</span>
                                        </div>
                                        {/* The headline number is the live wait where someone is
                                            actually stuck; otherwise it's just how many sit here. */}
                                        <div className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                                            {s.currentCount > 0 && !s.isTerminal
                                                ? `${s.longestWaitDays}d`
                                                : s.currentCount}
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-400 mt-1">
                                            {s.currentCount} here
                                            {s.visits > 0 && <> · avg {s.avgDays}d</>}
                                        </div>
                                        {!s.isTerminal && s.currentCount > 0 && (
                                            <div className={cn("mt-2 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black", style.pill)}>
                                                <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
                                                {SEVERITY_LABEL[s.severity]}
                                            </div>
                                        )}
                                    </div>
                                    {i < visibleStages.length - 1 && <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Candidate waiting list */}
            <Card className="border-slate-200">
                <CardContent className="p-0">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                        <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                            Who is waiting ({visibleCandidates.length})
                        </div>
                        {doneCount > 0 && (
                            <button
                                onClick={() => setShowDone(v => !v)}
                                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700"
                            >
                                {showDone ? "Hide finished" : `Show finished (${doneCount})`}
                            </button>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                                <tr>
                                    <th className="px-4 py-2.5 text-left">Candidate</th>
                                    <th className="px-4 py-2.5 text-left">Current Stage</th>
                                    {data.ownerRoleConfigured && <th className="px-4 py-2.5 text-left">Owner</th>}
                                    <th className="px-4 py-2.5 text-left">Waiting Since</th>
                                    <th className="px-4 py-2.5 text-right">Aging</th>
                                    <th className="px-4 py-2.5 text-left">Status</th>
                                    <th className="px-4 py-2.5 text-left">Last Moved By</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {visibleCandidates.map(c => {
                                    const style = SEVERITY_STYLES[c.severity];
                                    return (
                                        <tr key={c.jrCandidateId} className="hover:bg-slate-50/60">
                                            <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-100">{c.name}</td>
                                            <td className="px-4 py-2.5 text-slate-600">{c.status}</td>
                                            {data.ownerRoleConfigured && (
                                                <td className="px-4 py-2.5 text-slate-500 text-xs font-bold">{c.ownerRole || "—"}</td>
                                            )}
                                            <td className="px-4 py-2.5 text-slate-500 text-xs">
                                                {c.waitingSince ? formatDateForDisplay(c.waitingSince) : "—"}
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-black text-slate-800 dark:text-slate-100">{c.agingDays}d</td>
                                            <td className="px-4 py-2.5">
                                                {c.isTerminal ? (
                                                    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black text-slate-500">
                                                        Finished
                                                    </span>
                                                ) : (
                                                    <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black", style.pill)}>
                                                        <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
                                                        {SEVERITY_LABEL[c.severity]}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-400 text-xs">{c.lastUpdatedBy || "—"}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-4 py-2.5 border-t border-slate-100 text-[10px] text-slate-400 font-medium">
                        Thresholds — Attention {STAGE_THRESHOLDS.attention}d · Delayed {STAGE_THRESHOLDS.delayed}d · Critical {STAGE_THRESHOLDS.critical}d
                        {!data.ownerRoleConfigured && " · Set status owners in Settings → Status Master to split waiting days by team."}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
