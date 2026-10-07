"use client";

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Info, Loader2, RefreshCw, Route, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getJRStageAging, type JRStageAging, type StageAgingStage, type StageJourney } from "@/app/actions/jr-stage-aging";
import { SEVERITY_LABEL, STAGE_THRESHOLDS, severityForDays, type StageSeverity } from "@/lib/stage-aging";

type Mode = "people" | "days";

const PLACED_STATUS = "Successful Placement";

/** Colour always means how long the longest-waiting person in a stage has waited. */
const SEVERITY_STYLES: Record<StageSeverity, { chevron: string; text: string; bar: string; headline: string }> = {
    ok: {
        chevron: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
        text: "text-emerald-700 dark:text-emerald-400",
        bar: "bg-indigo-500",
        headline: "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50",
    },
    attention: {
        chevron: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
        text: "text-amber-700 dark:text-amber-300",
        bar: "bg-amber-500",
        headline: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
    },
    delayed: {
        chevron: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
        text: "text-orange-700 dark:text-orange-300",
        bar: "bg-orange-500",
        headline: "border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30",
    },
    critical: {
        chevron: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
        text: "text-red-700 dark:text-red-300",
        bar: "bg-red-500",
        headline: "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30",
    },
};

const GLOSSARY: { term: string; meaning: string }[] = [
    {
        term: "People / Days",
        meaning: "People shows how many candidates are in each step. Days shows the longest any one of them has waited there. The colour is the same in both.",
    },
    {
        term: "Longest wait",
        meaning: "Counted from that candidate's last status change. It is an unfinished wait, so the number grows every day until someone moves them. Once a JR is closed it stops at the closing date.",
    },
    {
        term: "Usually Nd",
        meaning: "Median of the candidates who have already left the step. Candidates still waiting are not included. \"rough\" means fewer than 5 candidates, so don't lean on it yet. In Days mode it is the tick on the bar.",
    },
    {
        term: "Attention / Delayed / Critical",
        meaning: `Waiting past ${STAGE_THRESHOLDS.attention} / ${STAGE_THRESHOLDS.delayed} / ${STAGE_THRESHOLDS.critical} days. Only work steps are flagged.`,
    },
    {
        term: "Waiting room",
        meaning: "Pool Candidate is a longlist nobody has contacted yet. Names resting there aren't a blockage, so it is never flagged and is left out of the Days scale.",
    },
    {
        term: "Path bar",
        meaning: "One real candidate's path from the day the JR opened, so the segments add up to the days open. It follows the candidate who was placed, or if nobody has been, the one furthest along (ties go to whoever got there first). The hatched part is the time before that candidate was added to the JR.",
    },
];

function fmtDate(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(`${iso}T00:00:00`);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The Days scale follows the data: the 7/14/21 thresholds when waits are short, wider when they are not. */
function daysScaleMax(workMax: number): number {
    if (workMax <= 28) return 28;
    if (workMax <= 120) return 120;
    return Math.ceil(workMax / 100) * 100;
}

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

/** One sentence that answers "where is this search stuck?" so the chart below is the detail, not the entry point. */
function Headline({ data }: { data: JRStageAging }) {
    const { worst, furthest, closedOn, activeCandidates } = data;
    const pool = data.mainPath.find(s => s.kind === "holding");
    const poolText = pool && pool.currentCount > 0
        ? ` Pool holds ${plural(pool.currentCount, "person", "people")}, the oldest for ${pool.longestWaitDays} days.`
        : "";

    let title: string;
    let sub: string;
    let tone: StageSeverity = "ok";

    if (worst) {
        title = closedOn
            ? `${plural(worst.count, "candidate was", "candidates were")} still waiting at ${worst.status}, up to ${worst.days} days`
            : `${plural(worst.count, "candidate has", "candidates have")} waited ${worst.days} days at ${worst.status}`;
        if (!closedOn) tone = severityForDays(worst.days);
        sub = closedOn
            ? `This JR closed on ${fmtDate(closedOn)}, so every wait is counted up to that date.`
            : `${furthest ? `Furthest anyone has got: ${furthest.status} (step ${furthest.position} of ${furthest.total}).` : ""}${poolText}`;
    } else if (activeCandidates > 0 && pool && pool.currentCount === activeCandidates) {
        title = `All ${activeCandidates} candidates are still in the pool. Nobody has moved on yet`;
        sub = `${pool.longestWaitDays > 0 ? `The oldest has been in the pool for ${pool.longestWaitDays} days. ` : ""}Pool is a waiting room, so nothing is flagged as delayed.`;
    } else if (activeCandidates > 0) {
        title = "Nobody is waiting in a work step right now";
        sub = poolText.trim();
    } else {
        title = "Nobody is in process right now";
        sub = closedOn ? `This JR closed on ${fmtDate(closedOn)}.` : "";
    }

    const Icon = tone === "ok" ? Info : AlertTriangle;
    return (
        <div role="status" className={cn("flex items-start gap-3 rounded-xl border p-4", SEVERITY_STYLES[tone].headline)}>
            <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", tone === "ok" ? "text-slate-500" : SEVERITY_STYLES[tone].text)} />
            <div className="min-w-0">
                <p className="text-base font-bold text-slate-900 dark:text-white text-balance">{title}</p>
                {sub && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

/**
 * One candidate's path from the day the JR opened, so the segments add up to the days open: the placed
 * candidate when someone has been placed, otherwise the candidate furthest along the main path.
 */
function JourneyStrip({ journey, closedOn }: { journey: StageJourney | null; closedOn: string | null }) {
    if (!journey) {
        return (
            <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-500">
                <span className="font-bold">{closedOn ? "Closed without anyone moving past the pool" : "Nobody has moved past the pool yet"}</span>
            </div>
        );
    }

    const placed = journey.kind === "placed";
    const segs = journey.segments;
    const lastIdx = segs.length - 1;
    const shade = (i: number) => 0.4 + (0.6 * i) / Math.max(1, segs.length - 1);
    const segStyle = (s: StageJourney["segments"][number], i: number): CSSProperties =>
        s.beforeAdded
            ? { backgroundImage: "repeating-linear-gradient(135deg, rgb(148 163 184 / .7) 0 3px, transparent 3px 6px)" }
            : { backgroundColor: `rgb(79 70 229 / ${shade(i).toFixed(2)})` };

    const endLine = placed
        ? `Placed on ${fmtDate(journey.endedOn)}`
        : closedOn
            ? `Closed at ${journey.currentStatus} · ${journey.currentDays} days there`
            : `Still at ${journey.currentStatus} · ${journey.currentDays} days`;

    return (
        <div className={cn(
            "rounded-xl border p-4",
            placed
                ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30"
                : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40"
        )}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-2.5 min-w-0">
                    {placed
                        ? <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        : <Route className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />}
                    <div>
                        <div className={cn("text-sm font-black", placed ? "text-emerald-700 dark:text-emerald-400" : "text-slate-800 dark:text-slate-100")}>
                            {placed ? `Successful Placement · ${journey.placedCount} placed` : "Path of the furthest candidate"}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            {journey.openedOn ? `JR opened ${fmtDate(journey.openedOn)} · ` : ""}
                            {placed ? `placed ${fmtDate(journey.endedOn)}` : closedOn ? `closed ${fmtDate(closedOn)}` : `today ${fmtDate(journey.endedOn)}`}
                        </div>
                    </div>
                </div>
                {journey.totalDays !== null && (
                    <div className="text-right">
                        <div className="text-3xl font-black text-slate-900 dark:text-white leading-none tabular-nums">{journey.totalDays} days</div>
                        <div className="text-[11px] text-slate-500 mt-1">{placed ? "from JR opened to placed" : closedOn ? "JR was open" : "since JR opened"}</div>
                    </div>
                )}
            </div>

            {segs.length > 0 && (
                <>
                    <div className="flex gap-0.5 h-5 mt-3.5" role="img" aria-label="Where the days went on this candidate's path">
                        {segs.map((s, i) => (
                            <div
                                key={`${s.label}-${i}`}
                                className={cn("rounded min-w-[3px]", !placed && i === lastIdx && "ring-2 ring-orange-400 ring-offset-1 ring-offset-transparent")}
                                style={{ flex: `${s.days} 1 0`, ...segStyle(s, i) }}
                                title={`${s.label} · ${s.days} days`}
                            />
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-xs text-slate-600 dark:text-slate-300">
                        {segs.map((s, i) => (
                            <span key={`${s.label}-l-${i}`} className="inline-flex items-center gap-1.5">
                                <i className="h-2.5 w-2.5 rounded-sm shrink-0" style={segStyle(s, i)} />
                                {s.label} <b className="text-slate-900 dark:text-white tabular-nums">{s.days}d</b>
                            </span>
                        ))}
                    </div>
                </>
            )}
            <p className={cn("text-xs mt-2.5", placed ? "text-emerald-700 dark:text-emerald-400 font-bold" : "text-orange-700 dark:text-orange-300 font-bold")}>
                {endLine}
            </p>
            {journey.candidateDays !== null && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {placed ? "The first candidate placed" : "This candidate"} has been in the JR for {journey.candidateDays} of those days.
                    {placed && journey.placedCount > 1 && ` ${journey.placedCount - 1} more ${journey.placedCount - 1 === 1 ? "has" : "have"} been placed since.`}
                </p>
            )}
        </div>
    );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
    return (
        <div role="radiogroup" aria-label="Pipeline shows" className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 shrink-0">
            {(["people", "days"] as Mode[]).map(m => (
                <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    onClick={() => onChange(m)}
                    className={cn(
                        "px-4 py-1.5 rounded-md text-xs font-bold transition-colors",
                        mode === m
                            ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                            : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    {m === "people" ? "People" : "Days"}
                </button>
            ))}
        </div>
    );
}

const NOTCH = 16;
const chevronClip = (first: boolean, last: boolean): string => {
    const right = last ? "100% 0, 100% 100%" : `calc(100% - ${NOTCH}px) 0, 100% 50%, calc(100% - ${NOTCH}px) 100%`;
    const left = first ? "0 100%" : `0 100%, ${NOTCH}px 50%`;
    return `polygon(0 0, ${right}, ${left})`;
};

/** One step of the pipeline: the big number, a thin bar on the same scale, then the name and a line of detail. */
function PipelineStep({ stage, index, first, last, mode, scaleMax }: {
    stage: StageAgingStage; index: number; first: boolean; last: boolean; mode: Mode; scaleMax: number;
}) {
    const days = mode === "days";
    const holding = stage.kind === "holding";
    const notReached = !stage.everVisited;
    const hasPeople = stage.currentCount > 0;
    const sev = !holding && hasPeople ? stage.severity : "ok";
    const style = SEVERITY_STYLES[sev];
    const usual = stage.medianCompletedDays !== null
        ? `usually ${stage.medianCompletedDays}d${stage.completedCount < 5 ? " (rough)" : ""}`
        : null;

    let big: ReactNode = "—";
    let sub: ReactNode;
    let fill = 0;
    let fillClass = style.bar;
    let tick: number | null = null;

    if (notReached) {
        sub = "Not reached yet";
    } else if (holding) {
        fillClass = "bg-slate-400/60";
        if (days) {
            sub = <>{plural(stage.currentCount, "person", "people")}<small className="block font-normal text-slate-400">waiting room, not on this scale</small></>;
        } else {
            big = stage.currentCount;
            fill = stage.currentCount / scaleMax;
            sub = <>Waiting room<small className="block font-normal text-slate-400">oldest {stage.longestWaitDays} days</small></>;
        }
    } else if (!hasPeople) {
        big = "0";
        sub = <>Nobody waiting{usual && <small className="block font-normal text-slate-400">{usual}</small>}</>;
        if (days && stage.medianCompletedDays !== null && stage.medianCompletedDays <= scaleMax) tick = stage.medianCompletedDays / scaleMax;
    } else {
        big = days ? stage.longestWaitDays : stage.currentCount;
        fill = (days ? stage.longestWaitDays : stage.currentCount) / scaleMax;
        if (days && stage.medianCompletedDays !== null && stage.medianCompletedDays <= scaleMax) tick = stage.medianCompletedDays / scaleMax;
        sub = days
            ? <>{plural(stage.currentCount, "person", "people")}<small className="block font-normal text-slate-400">{usual ?? "no finished stays yet"}</small></>
            : <>
                <span className={cn("inline-flex items-center gap-1", style.text)}>
                    {sev === "ok" ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    {SEVERITY_LABEL[sev]}
                </span>
                <small className="block font-normal text-slate-400">longest wait {stage.longestWaitDays} days</small>
            </>;
    }

    let unit: string | null = null;
    if (!notReached && hasPeople) {
        if (!days) unit = stage.currentCount === 1 ? "person" : "people";
        else if (!holding) unit = "days";
    }

    return (
        <div className={cn("flex-1 min-w-0 flex flex-col gap-2", !first && "-ml-2.5", notReached && "opacity-60")}>
            <div
                className={cn(
                    "h-16 flex items-center justify-center gap-1.5 px-5 text-2xl font-black tabular-nums",
                    first && "rounded-l-xl", last && "rounded-r-xl",
                    notReached ? "bg-slate-100 text-slate-400 dark:bg-slate-800" : holding ? SEVERITY_STYLES.ok.chevron : style.chevron
                )}
                style={{ clipPath: chevronClip(first, last) }}
            >
                {big}
                {unit && <span className="text-[11px] font-bold opacity-80">{unit}</span>}
            </div>
            <div className="relative h-1.5 mx-3.5 rounded-full bg-slate-200 dark:bg-slate-700">
                {fill > 0 && <div className={cn("absolute inset-y-0 left-0 rounded-full", fillClass)} style={{ width: `${Math.min(100, Math.max(3, fill * 100))}%` }} />}
                {tick !== null && (
                    <div
                        title={`Usually ${stage.medianCompletedDays} days`}
                        className={cn(
                            "absolute -top-1 -bottom-1 w-[3px] -ml-[1.5px] rounded",
                            stage.completedCount < 5
                                ? "bg-white dark:bg-slate-900 border-[1.5px] border-slate-900 dark:border-white"
                                : "bg-slate-900 dark:bg-white ring-[1.5px] ring-white dark:ring-slate-900"
                        )}
                        style={{ left: `${tick * 100}%` }}
                    />
                )}
            </div>
            <div className="text-xs font-bold leading-snug text-center px-3 min-h-[48px] text-slate-800 dark:text-slate-100">
                {index + 1} · {stage.status}
            </div>
            <div className={cn("text-[11.5px] font-bold text-center px-2.5 leading-snug", notReached || holding || !hasPeople ? "text-slate-500" : days ? "text-slate-600 dark:text-slate-300" : "")}>
                {sub}
            </div>
        </div>
    );
}

export function StageAgingPanel({ jrId }: { jrId: string }) {
    const [data, setData] = useState<JRStageAging | null>(null);
    const [loading, setLoading] = useState(true);
    const [showGlossary, setShowGlossary] = useState(false);
    const [mode, setMode] = useState<Mode>("people");

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

    const droppedStages = data.exits.filter(s => s.status !== PLACED_STATUS && s.currentCount > 0);
    const droppedTotal = droppedStages.reduce((sum, s) => sum + s.currentCount, 0);

    const workMax = data.mainPath.filter(s => s.kind === "work").reduce((m, s) => Math.max(m, s.longestWaitDays), 0);
    const peopleMax = data.mainPath.reduce((m, s) => Math.max(m, s.currentCount), 0);
    const scaleMax = mode === "days" ? daysScaleMax(workMax) : Math.max(10, Math.ceil(peopleMax / 10) * 10);

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

            <Headline data={data} />
            <JourneyStrip journey={data.journey} closedOn={data.closedOn} />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatCard
                    label={data.closedOn ? "In Process At Close" : "In Process"}
                    value={data.activeCandidates}
                    hint={droppedTotal > 0 ? `${droppedTotal} dropped out` : undefined}
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
                    label={data.closedOn ? "Days Open (closed)" : "Days Open"}
                    value={data.totalOpenDays ?? "—"}
                    hint={data.closedOn ? `closed ${fmtDate(data.closedOn)}` : undefined}
                    icon={Clock}
                    tone="indigo"
                />
            </div>

            <Card className="border-slate-200">
                <CardContent className="p-4 space-y-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                            <div className="text-base font-extrabold text-slate-900 dark:text-white">
                                {mode === "days" ? "How long have they waited, compared with usual?" : "Where are people right now?"}
                            </div>
                            <div className="text-xs text-slate-500">
                                {mode === "days"
                                    ? "Big number = the longest wait in each step, in days."
                                    : "Big number = how many people are in each step."}
                            </div>
                        </div>
                        <ModeToggle mode={mode} onChange={setMode} />
                    </div>

                    <div className="overflow-x-auto pb-2">
                        <div className="flex min-w-[900px] pt-1">
                            {data.mainPath.map((s, i) => (
                                <PipelineStep
                                    key={s.status}
                                    stage={s}
                                    index={i}
                                    first={i === 0}
                                    last={i === data.mainPath.length - 1}
                                    mode={mode}
                                    scaleMax={scaleMax}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                        {([["ok", `Under ${STAGE_THRESHOLDS.attention} days`], ["attention", `${STAGE_THRESHOLDS.attention}–${STAGE_THRESHOLDS.delayed - 1}`], ["delayed", `${STAGE_THRESHOLDS.delayed}–${STAGE_THRESHOLDS.critical - 1}`], ["critical", `${STAGE_THRESHOLDS.critical}+`]] as [StageSeverity, string][]).map(([sev, label]) => (
                            <span key={sev} className="inline-flex items-center gap-1.5">
                                <i className={cn("h-2.5 w-2.5 rounded-sm", SEVERITY_STYLES[sev].bar)} />{label}
                            </span>
                        ))}
                        {mode === "days" && (
                            <span className="inline-flex items-center gap-1.5">
                                <i className="h-3 w-[3px] rounded bg-slate-900 dark:bg-white" />Usually takes
                            </span>
                        )}
                        <span className="text-slate-400">· thin bar scale 0–{scaleMax} {mode === "days" ? "days" : "people"}{mode === "days" ? ", pool left out" : ""}</span>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-bold">
                            Dropped out · {droppedTotal}
                        </span>
                        {droppedStages.length === 0 && <span className="text-slate-400">Nobody has dropped out.</span>}
                        {droppedStages.map(s => (
                            <span key={s.status} className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-0.5 font-bold text-slate-800 dark:text-slate-100">
                                {s.currentCount} {s.status}
                            </span>
                        ))}
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
