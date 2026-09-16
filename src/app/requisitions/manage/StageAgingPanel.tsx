"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ChevronRight, Clock, Info, Loader2, RefreshCw, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getJRStageAging, type JRStageAging, type StageAgingStage } from "@/app/actions/jr-stage-aging";
import { SEVERITY_LABEL, severityForDays, STAGE_THRESHOLDS, type StageSeverity } from "@/lib/stage-aging";

const SEVERITY_STYLES: Record<StageSeverity, { pill: string; card: string; dot: string }> = {
    ok: { pill: "bg-emerald-50 text-emerald-700 border-emerald-200", card: "border-slate-200", dot: "bg-emerald-500" },
    attention: { pill: "bg-amber-50 text-amber-700 border-amber-200", card: "border-amber-300 bg-amber-50/40", dot: "bg-amber-500" },
    delayed: { pill: "bg-orange-50 text-orange-700 border-orange-200", card: "border-orange-300 bg-orange-50/50", dot: "bg-orange-500" },
    critical: { pill: "bg-red-50 text-red-700 border-red-200", card: "border-red-300 bg-red-50/50", dot: "bg-red-500" },
};

const GLOSSARY: { term: string; meaning: string }[] = [
    {
        term: "No movement for N days",
        meaning: "Counted from that candidate's last status change up to today. It is an unfinished wait — the number grows every day until someone moves them.",
    },
    {
        term: "Usually N days",
        meaning: "Median of the candidates who have already left the stage. Candidates still waiting are excluded, so this number stays put instead of drifting upward on its own.",
    },
    {
        term: "n = 4",
        meaning: "How many finished durations the median is built from. A small n means don't lean on it yet.",
    },
    {
        term: "Attention / Delayed / Critical",
        meaning: `Waiting past ${STAGE_THRESHOLDS.attention} / ${STAGE_THRESHOLDS.delayed} / ${STAGE_THRESHOLDS.critical} days. Only work stages are flagged.`,
    },
    {
        term: "In pool",
        meaning: "Pool Candidate is a longlist nobody has contacted yet. Names resting there aren't a blockage, so it never becomes the bottleneck and carries no timing stats.",
    },
    {
        term: "Not reached yet",
        meaning: "A stage on the main path no candidate in this JR has got to. Shown greyed so you can see how many steps are left.",
    },
];

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
                <div className={cn("p-2.5 rounded-xl shrink-0", tones[tone])}><Icon className="h-5 w-5" /></div>
                <div className="min-w-0">
                    <div className="text-2xl font-black text-slate-900 dark:text-white leading-none">{value}</div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-1">{label}</div>
                    {hint && <div className="text-[11px] text-slate-400 font-medium truncate">{hint}</div>}
                </div>
            </CardContent>
        </Card>
    );
}

/** One step on the main path. Every figure carries its unit so no two cards mean different things. */
function StageCard({ stage }: { stage: StageAgingStage }) {
    const style = SEVERITY_STYLES[stage.severity];
    const isHolding = stage.kind === "holding";
    const notReached = !stage.everVisited;

    return (
        <div
            className={cn(
                "rounded-xl border p-3 w-[196px] shrink-0 bg-white dark:bg-slate-900",
                style.card,
                isHolding && "border-dashed bg-slate-50 dark:bg-slate-800/40",
                notReached && "border-dashed bg-transparent opacity-60"
            )}
        >
            <div className="flex items-start gap-2 mb-2 min-h-[32px]">
                <span className="h-5 w-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black flex items-center justify-center shrink-0">
                    {stage.stageOrder}
                </span>
                <span className="text-[11px] font-bold text-slate-600 leading-tight line-clamp-2">{stage.status}</span>
                {isHolding && <span className="ml-auto text-[9px] font-black uppercase tracking-wider text-slate-400">Pool</span>}
            </div>

            {isHolding ? (
                <>
                    <div className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                        {stage.currentCount}
                        <span className="text-[11px] font-bold text-slate-400 ml-1">in pool</span>
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 mt-1.5 leading-relaxed">
                        Not contacted yet
                        {stage.longestWaitDays > 0 && <> · oldest {stage.longestWaitDays}d</>}
                    </div>
                </>
            ) : (
                <>
                    <div className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                        {stage.currentCount > 0 ? `${stage.longestWaitDays}d` : "—"}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 mt-1.5 leading-relaxed">
                        {stage.currentCount > 0
                            ? <>No movement · {stage.currentCount} here</>
                            : notReached ? "Not reached yet" : "Nobody waiting"}
                        {!notReached && (
                            <>
                                <br />
                                {stage.medianCompletedDays !== null
                                    ? <>Usually {stage.medianCompletedDays}d (n={stage.completedCount})</>
                                    : "Nobody has finished this stage yet"}
                            </>
                        )}
                    </div>
                </>
            )}

            {stage.severity !== "ok" && (
                <div className={cn("mt-2 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black", style.pill)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
                    {SEVERITY_LABEL[stage.severity]}
                </div>
            )}
        </div>
    );
}

export function StageAgingPanel({ jrId }: { jrId: string }) {
    const [data, setData] = useState<JRStageAging | null>(null);
    const [loading, setLoading] = useState(true);
    const [showGlossary, setShowGlossary] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setData(await getJRStageAging(jrId));
        } catch (e) {
            console.error("Failed to load stage aging", e);
        } finally {
            setLoading(false);
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

    if (!data || (data.activeCandidates === 0 && data.exitedCandidates === 0)) {
        return (
            <Card className="border-dashed">
                <CardContent className="py-12 text-center space-y-1">
                    <p className="text-sm font-bold text-slate-600">No candidates in this JR yet</p>
                    <p className="text-xs text-slate-400">Stage aging appears once candidates are added and their status starts moving.</p>
                </CardContent>
            </Card>
        );
    }

    const usedExits = data.exits.filter(s => s.currentCount > 0);
    const unusedExits = data.exits.filter(s => s.currentCount === 0);

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Stage Aging &amp; Bottleneck</h3>
                    <p className="text-xs text-slate-400 font-medium">Where the search is waiting right now, and how far it has actually got.</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => setShowGlossary(v => !v)}
                        aria-expanded={showGlossary}
                    >
                        <Info className="h-3.5 w-3.5" /> What the numbers mean
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2" onClick={load}>
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh
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

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Open Days" value={data.totalOpenDays ?? "—"} icon={Clock} tone="indigo" />
                <StatCard
                    label="In Process"
                    value={data.activeCandidates}
                    hint={data.exitedCandidates > 0 ? `${data.exitedCandidates} dropped out` : undefined}
                    icon={Users}
                />
                <StatCard
                    label={`Waiting Over ${STAGE_THRESHOLDS.delayed}d`}
                    value={data.overdueCount}
                    hint="pool not counted"
                    icon={AlertCircle}
                    tone={data.overdueCount > 0 ? "red" : "slate"}
                />
                <StatCard
                    label="Reached Step"
                    value={data.furthest ? `${data.furthest.position} / ${data.furthest.total}` : "—"}
                    hint={data.furthest?.status}
                    icon={ChevronRight}
                />
            </div>

            <Card className="border-slate-200">
                <CardContent className="p-4 text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                    Open <b className="text-slate-900 dark:text-white">{data.totalOpenDays ?? "—"} days</b>
                    {data.furthest && <> · furthest anyone has got is <b className="text-slate-900 dark:text-white">{data.furthest.status}</b></>}
                    {data.worst && <> · longest hold-up is <b className="text-slate-900 dark:text-white">{data.worst.status}</b> ({data.worst.count} {data.worst.count === 1 ? "candidate" : "candidates"}, {data.worst.days} days)</>}
                </CardContent>
            </Card>

            {data.actions.length > 0 && (
                <Card className="border-slate-200 overflow-hidden">
                    <CardContent className="p-0">
                        <div className="px-4 py-2.5 border-b border-slate-100 text-[11px] font-black uppercase tracking-wider text-slate-500">
                            Needs attention — nearest to a placement first
                        </div>
                        {data.actions.map((a, i) => {
                            const isPool = a.kind === "holding";
                            const sev: StageSeverity = isPool ? "ok" : severityForDays(a.days);
                            const style = SEVERITY_STYLES[sev];
                            return (
                                <div
                                    key={a.status}
                                    className={cn(
                                        "flex items-start gap-3 px-4 py-3 border-t border-slate-50 first:border-t-0",
                                        isPool ? "bg-slate-50/60 dark:bg-slate-800/30" : sev === "critical" ? "bg-red-50/50" : "bg-amber-50/40"
                                    )}
                                >
                                    <span className={cn("text-xs font-black w-4 shrink-0 pt-0.5", isPool ? "text-slate-400" : "text-slate-500")}>
                                        {isPool ? "—" : i + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-black text-slate-900 dark:text-white">{a.status}</div>
                                        <div className="text-[11px] font-bold text-slate-500 mt-0.5">
                                            {a.count} {a.count === 1 ? "candidate" : "candidates"}
                                            {a.ownerRole && <> · owner: {a.ownerRole}</>}
                                            {isPool && <> · longlist, not chased</>}
                                        </div>
                                    </div>
                                    <span className={cn("text-sm font-black shrink-0", isPool ? "text-slate-400" : style.dot.replace("bg-", "text-"))}>
                                        {a.days}d
                                    </span>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            <Card className="border-slate-200">
                <CardContent className="p-4 space-y-4">
                    <div>
                        <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Main path</div>
                        <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
                            {data.mainPath.map((s, i) => (
                                <div key={s.status} className="flex items-center gap-2 shrink-0">
                                    <StageCard stage={s} />
                                    {i < data.mainPath.length - 1 && <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                            Dropped out · {data.exitedCandidates} {data.exitedCandidates === 1 ? "candidate" : "candidates"}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {usedExits.map(s => (
                                <div key={s.status} className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 dark:bg-slate-800/40 px-3 py-2">
                                    <span className="text-lg font-black text-slate-700 dark:text-slate-200">{s.currentCount}</span>
                                    <span className="text-[11px] font-bold text-slate-500 leading-tight">{s.status}</span>
                                </div>
                            ))}
                            {unusedExits.length > 0 && (
                                <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-slate-200 px-3 py-2">
                                    <span className="text-lg font-black text-slate-300">0</span>
                                    <span className="text-[11px] font-bold text-slate-300 leading-tight">
                                        {unusedExits.map(s => s.status).join(" · ")}
                                    </span>
                                </div>
                            )}
                            {usedExits.length === 0 && unusedExits.length === 0 && (
                                <span className="text-xs text-slate-400 font-medium">Nobody has dropped out.</span>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {data.ownerRoleConfigured && data.ownerDays.length > 0 && (
                <Card className="border-slate-200">
                    <CardContent className="p-4">
                        <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-3">Waiting days by owner</div>
                        <div className="flex flex-wrap gap-5">
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
        </div>
    );
}
