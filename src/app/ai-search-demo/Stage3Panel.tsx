"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
    Sparkles, Loader2, RotateCcw, ChevronDown, ChevronUp,
    Briefcase, Target, Globe, Wrench, BarChart3, ChevronRight,
    History, CheckCircle2, Clock, XCircle, ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    createSearchSession, triggerSearchRanking, getSearchJobStatus, getSearchJobHistory,
    type SearchJobData, type SearchResult, type SearchJobSummary,
} from "@/app/actions/ai-search-ranking";

interface Props {
    candidateIds: string[];
    initialQuery?: string;
}

// ── Category definitions ────────────────────────
type CategoryKey = "overall" | "experience" | "leadership" | "market" | "skills";

const CATEGORIES: {
    key: CategoryKey; label: string; icon: typeof Sparkles;
    color: string; bgColor: string; borderColor: string;
    scoreKey?: keyof Stage3Result; summaryKey?: keyof Stage3Result; max: number;
}[] = [
    { key: "overall",    label: "Overall",               icon: BarChart3, color: "text-indigo-600",  bgColor: "bg-indigo-50",  borderColor: "border-indigo-200", max: 100 },
    { key: "experience", label: "Experience",             icon: Briefcase, color: "text-emerald-600", bgColor: "bg-emerald-50", borderColor: "border-emerald-200", scoreKey: "experience_score", summaryKey: "experience_summary", max: 25 },
    { key: "leadership", label: "Leadership",             icon: Target,    color: "text-violet-600",  bgColor: "bg-violet-50",  borderColor: "border-violet-200", scoreKey: "leadership_score", summaryKey: "leadership_summary", max: 25 },
    { key: "market",     label: "Market & Network",       icon: Globe,     color: "text-sky-600",     bgColor: "bg-sky-50",     borderColor: "border-sky-200",    scoreKey: "market_score",     summaryKey: "market_summary",     max: 25 },
    { key: "skills",     label: "Skill Set",              icon: Wrench,    color: "text-orange-600",  bgColor: "bg-orange-50",  borderColor: "border-orange-200", scoreKey: "skills_score",     summaryKey: "skills_summary",     max: 25 },
];

type Stage3JobData = SearchJobData;
type Stage3Result = SearchResult;

// ── Score Bar ───────────────────────────────────
function ScoreBar({ score, max = 100, size = "md" }: { score: number; max?: number; size?: "sm" | "md" }) {
    const pct = Math.min(100, Math.round((score / max) * 100));
    const color = pct >= 75 ? "bg-emerald-500" : pct >= 55 ? "bg-amber-400" : "bg-rose-400";
    const w = size === "sm" ? "w-14" : "w-20";
    const h = size === "sm" ? "h-1" : "h-1.5";
    return (
        <div className="flex items-center gap-1.5">
            <div className={`${w} ${h} bg-slate-100 rounded-full overflow-hidden`}>
                <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
            </div>
            <span className={`text-xs font-bold tabular-nums ${pct >= 75 ? "text-emerald-600" : pct >= 55 ? "text-amber-600" : "text-rose-500"}`}>
                {score}
            </span>
        </div>
    );
}

// ── Rank Badge ──────────────────────────────────
function RankBadge({ rank }: { rank: number }) {
    const style = rank === 1
        ? "bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-amber-200 shadow-sm"
        : rank <= 3
            ? "bg-gradient-to-br from-slate-200 to-slate-300 text-slate-700"
            : "bg-slate-100 text-slate-500";
    return (
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${style}`}>
            {rank}
        </div>
    );
}

// ── Category Button ─────────────────────────────
function CategoryButton({ cat, avgScore, active, onClick }: {
    cat: typeof CATEGORIES[number]; avgScore: number | null; active: boolean; onClick: () => void;
}) {
    const Icon = cat.icon;
    return (
        <button
            onClick={onClick}
            className={`
                flex flex-col gap-1.5 px-4 py-3 rounded-xl border-2 transition-all duration-200 min-w-[130px] text-left
                ${active
                    ? `${cat.bgColor} ${cat.borderColor} shadow-md`
                    : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm"
                }
            `}
        >
            <div className="flex items-center gap-1.5">
                <Icon className={`w-3.5 h-3.5 ${active ? cat.color : "text-slate-400"}`} />
                <span className={`text-[11px] font-semibold leading-tight ${active ? cat.color : "text-slate-500"}`}>{cat.label}</span>
            </div>
            {avgScore !== null && (
                <div className="w-full space-y-1">
                    <div className="flex items-baseline justify-between">
                        <span className={`text-xl font-extrabold tabular-nums ${active ? cat.color : "text-slate-700"}`}>
                            {avgScore.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">/ {cat.max}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${active ? cat.color.replace("text-", "bg-") : "bg-slate-300"}`}
                            style={{ width: `${Math.min(100, (avgScore / cat.max) * 100)}%` }}
                        />
                    </div>
                </div>
            )}
        </button>
    );
}

// ── Bullet Insights ─────────────────────────────
function BulletInsights({ summary }: { summary: string | null }) {
    if (!summary) return <p className="text-xs text-slate-400 italic py-1">No data</p>;
    const bullets = summary.split("|").map(b => b.trim()).filter(Boolean);
    return (
        <div className="space-y-1.5 py-1">
            {bullets.map((b, i) => {
                const isWarning = b.includes("⚠️") || b.includes("⚠");
                return (
                    <p key={i} className={`text-xs leading-relaxed ${isWarning ? "text-amber-700" : "text-slate-700"}`}>{b}</p>
                );
            })}
        </div>
    );
}

// ── Result Row ──────────────────────────────────
function ResultRow({ r, activeCategory, displayRank }: { r: Stage3Result; activeCategory: CategoryKey; displayRank: number }) {
    const [expanded, setExpanded] = useState(false);
    const cat = CATEGORIES.find(c => c.key === activeCategory)!;

    const displayScore = activeCategory === "overall" ? r.score :
        (r[cat.scoreKey as keyof Stage3Result] as number | null) ?? null;
    const displayMax = cat.max;

    const displaySummary = activeCategory === "overall"
        ? (r.strengths || "") + (r.gaps ? ` | ⚠️ ${r.gaps}` : "") + (r.tradeoff ? ` | ↔ ${r.tradeoff}` : "")
        : (r[cat.summaryKey as keyof Stage3Result] as string | null);

    const miniScores = CATEGORIES.filter(c => c.key !== "overall" && c.scoreKey).map(c => ({
        ...c, value: (r[c.scoreKey as keyof Stage3Result] as number | null),
    }));

    const has4DimData = r.experience_score !== null;

    return (
        <div className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
            <div className="flex items-start gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded(v => !v)}>
                <RankBadge rank={displayRank} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-semibold text-slate-900">{r.name}</span>
                    </div>
                    {(r.position || r.company) && (
                        <p className="text-xs text-slate-500 truncate">{[r.position, r.company].filter(Boolean).join(" @ ")}</p>
                    )}

                    {activeCategory === "overall" && has4DimData && (
                        <div className="flex gap-2 mt-2.5 flex-wrap">
                            {miniScores.map(ms => ms.value !== null && (
                                <div key={ms.key} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${ms.bgColor} border ${ms.borderColor}`}>
                                    <span className={`text-xs font-semibold ${ms.color}`}>{ms.label.split(" ")[0]}</span>
                                    <span className={`text-base font-extrabold tabular-nums ${ms.color}`}>{ms.value}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeCategory !== "overall" && displaySummary && (
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">
                            {displaySummary.split("|")[0]?.trim()}
                        </p>
                    )}
                    {activeCategory === "overall" && (
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">{r.strengths}</p>
                    )}

                    {expanded && (
                        <div className="mt-2 pt-2 border-t border-slate-100">
                            {activeCategory === "overall" ? (
                                <div className="space-y-1.5">
                                    {r.gaps && <p className="text-xs text-rose-500 leading-relaxed">⚠ {r.gaps}</p>}
                                    {r.tradeoff && <p className="text-xs text-slate-500 italic leading-relaxed">↔ {r.tradeoff}</p>}
                                    {has4DimData && (
                                        <div className="mt-3 space-y-3">
                                            {CATEGORIES.filter(c => c.key !== "overall" && c.summaryKey).map(c => {
                                                const catSummary = r[c.summaryKey as keyof Stage3Result] as string | null;
                                                const catScore = r[c.scoreKey as keyof Stage3Result] as number | null;
                                                const Icon = c.icon;
                                                return (
                                                    <div key={c.key} className={`p-2.5 rounded-lg ${c.bgColor} border ${c.borderColor}`}>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <Icon className={`w-3 h-3 ${c.color}`} />
                                                                <span className={`text-[11px] font-semibold ${c.color}`}>{c.label}</span>
                                                            </div>
                                                            {catScore !== null && <span className={`text-xs font-bold ${c.color}`}>{catScore}/25</span>}
                                                        </div>
                                                        <BulletInsights summary={catSummary} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <BulletInsights summary={displaySummary} />
                            )}
                        </div>
                    )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0 mt-0.5">
                    {displayScore !== null && <ScoreBar score={displayScore} max={displayMax} />}
                    {expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                </div>
            </div>
        </div>
    );
}

// ── History Item ────────────────────────────────
function HistoryItem({ job, onLoad }: { job: SearchJobSummary; onLoad: (job: SearchJobSummary) => void }) {
    const statusIcon = job.status === "completed"
        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        : job.status === "failed"
            ? <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            : <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />;

    const date = new Date(job.created_at);
    const dateStr = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
    const timeStr = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    return (
        <div className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 cursor-pointer group" onClick={() => onLoad(job)}>
            <div className="mt-0.5">{statusIcon}</div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">{job.query}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                    {job.candidate_count} candidates
                    {job.result_count ? ` → ${job.result_count} ranked` : ""}
                    <span className="mx-1.5">·</span>{dateStr} {timeStr}
                </p>
                {job.final_recommendation && (
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2">{job.final_recommendation}</p>
                )}
            </div>
            <span className="text-[10px] text-indigo-500 font-semibold opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">Load →</span>
        </div>
    );
}

// ── Main Component ──────────────────────────────
export function Stage3Panel({ candidateIds, initialQuery = "" }: Props) {
    const [expanded, setExpanded] = useState(false);
    const [view, setView] = useState<"main" | "history">("main");
    const [query, setQuery] = useState(initialQuery);
    const [status, setStatus] = useState<"idle" | "processing" | "completed" | "error">("idle");
    const [pollingStatus, setPollingStatus] = useState<string | null>(null);
    const [data, setData] = useState<Stage3JobData | null>(null);
    const [candidateCount, setCandidateCount] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<CategoryKey>("overall");
    const [history, setHistory] = useState<SearchJobSummary[] | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const jobIdRef = useRef<string | null>(null);

    // Sync initialQuery when it changes (e.g., new AI search)
    useEffect(() => {
        if (initialQuery) setQuery(initialQuery);
    }, [initialQuery]);

    const stopPolling = () => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
    useEffect(() => () => stopPolling(), []);

    const startPolling = (jobId: string) => {
        jobIdRef.current = jobId;
        pollRef.current = setInterval(async () => {
            try {
                const result = await getSearchJobStatus(jobId);
                if (!result) {
                    stopPolling(); setStatus("error"); setErrorMsg("ไม่พบข้อมูล job");
                } else {
                    setPollingStatus(result.status);
                    if (result.results.length > 0) setData(result);
                    if (result.status === "completed") { stopPolling(); setStatus("completed"); }
                }
            } catch {
                stopPolling(); setStatus("error"); setErrorMsg("เกิดข้อผิดพลาดระหว่าง polling");
            }
        }, 4000);
    };

    const handleAnalyse = async () => {
        if (!query.trim() || !candidateIds.length) return;
        stopPolling();
        setLoading(true);
        setStatus("processing");
        setPollingStatus(null);
        setData(null);
        setErrorMsg(null);
        setActiveCategory("overall");
        setExpanded(true);
        try {
            const sessionName = `${query.trim().substring(0, 40)} — ${candidateIds.length} candidates`;
            let sessionId: string | null = null;
            try {
                sessionId = await createSearchSession(sessionName, null, candidateIds.length);
            } catch {
                // session creation is optional — proceed without it
            }
            const { jobId, candidateCount: cnt } = await triggerSearchRanking(sessionId, candidateIds, query.trim());
            setCandidateCount(cnt);
            startPolling(jobId);
        } catch (err: any) {
            setStatus("error");
            setErrorMsg(err.message ?? "เกิดข้อผิดพลาด");
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        stopPolling(); setStatus("idle"); setData(null); setActiveCategory("overall"); setPollingStatus(null); setView("main");
    };

    const handleOpenHistory = async () => {
        setView("history");
        setExpanded(true);
        if (history) return;
        setHistoryLoading(true);
        try {
            const jobs = await getSearchJobHistory(30);
            setHistory(jobs);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleLoadHistoryJob = async (job: SearchJobSummary) => {
        stopPolling();
        setView("main");
        setQuery(job.query);
        setCandidateCount(job.candidate_count);
        setActiveCategory("overall");
        setExpanded(true);

        if (job.status === "completed" || job.status === "analysing" || job.status === "pending_summary" || job.status === "ready_to_analyse") {
            setStatus(job.status === "completed" ? "completed" : "processing");
            setPollingStatus(job.status);
            const result = await getSearchJobStatus(job.job_id);
            if (result) {
                setData(result);
                if (result.status === "completed") {
                    setStatus("completed");
                } else {
                    setStatus("processing");
                    startPolling(job.job_id);
                }
            } else {
                setStatus("error");
                setErrorMsg("ไม่พบข้อมูล job");
            }
        } else {
            setStatus("error");
            setErrorMsg(`Job status: ${job.status}`);
        }
    };

    const sortedResults = useMemo(() => {
        if (!data?.results?.length) return [];
        const results = [...data.results];
        if (activeCategory === "overall") return results.sort((a, b) => b.score - a.score || (a.rank ?? 999) - (b.rank ?? 999));
        const cat = CATEGORIES.find(c => c.key === activeCategory);
        if (!cat?.scoreKey) return results;
        return results.sort((a, b) => {
            const sa = (a[cat.scoreKey as keyof Stage3Result] as number | null) ?? -1;
            const sb = (b[cat.scoreKey as keyof Stage3Result] as number | null) ?? -1;
            return sb - sa || (a.rank ?? 999) - (b.rank ?? 999);
        });
    }, [data?.results, activeCategory]);

    const avgScores = useMemo(() => {
        const results = data?.results;
        if (!results?.length) return null;
        return {
            overall:    Math.round((results.reduce((s, r) => s + r.score, 0) / results.length) * 10) / 10,
            experience: Math.round((results.reduce((s, r) => s + (r.experience_score ?? 0), 0) / results.length) * 10) / 10,
            leadership: Math.round((results.reduce((s, r) => s + (r.leadership_score ?? 0), 0) / results.length) * 10) / 10,
            market:     Math.round((results.reduce((s, r) => s + (r.market_score ?? 0), 0) / results.length) * 10) / 10,
            skills:     Math.round((results.reduce((s, r) => s + (r.skills_score ?? 0), 0) / results.length) * 10) / 10,
        };
    }, [data?.results]);

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {/* Header — always visible */}
            <div className="flex items-center px-5 py-4">
                <button
                    className="flex-1 flex items-center gap-2.5 hover:opacity-80 transition-opacity text-left"
                    onClick={() => { setView("main"); setExpanded(v => !v); }}
                >
                    <div className="p-1.5 bg-indigo-100 rounded-lg">
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-800">AI Ranking — Stage 3</p>
                        <p className="text-xs text-slate-500">
                            {status === "idle" && `${candidateIds.length.toLocaleString()} candidates ready to evaluate`}
                            {status === "processing" && (
                                <span className="text-indigo-600 flex items-center gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin inline" />
                                    {data?.results.length ? ` ${data.results.length} / ${candidateCount ?? "?"} done` : ` Evaluating ${candidateCount ?? candidateIds.length} candidates...`}
                                </span>
                            )}
                            {status === "completed" && `Completed — ${data?.results.length ?? 0} candidates ranked`}
                            {status === "error" && <span className="text-rose-500">Error</span>}
                        </p>
                    </div>
                </button>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleOpenHistory}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                        title="View history"
                    >
                        <History className="w-3.5 h-3.5" />
                        History
                    </button>
                    <ChevronRight
                        className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`}
                        onClick={() => { setView("main"); setExpanded(v => !v); }}
                    />
                </div>
            </div>

            {/* Body */}
            {expanded && view === "history" && (
                <div className="border-t border-slate-100">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                        <button onClick={() => setView("main")} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold">
                            <ChevronLeft className="w-3.5 h-3.5" /> Back
                        </button>
                        <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Ranking History</span>
                    </div>
                    {historyLoading && (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                        </div>
                    )}
                    {!historyLoading && history?.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-8">No history yet</p>
                    )}
                    {!historyLoading && history && history.length > 0 && (
                        <div className="max-h-[400px] overflow-y-auto">
                            {history.map(job => (
                                <HistoryItem key={job.job_id} job={job} onLoad={handleLoadHistoryJob} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {expanded && view === "main" && (
                <div className="border-t border-slate-100 p-4 space-y-4">
                    {/* Query + Analyse button */}
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Evaluation Criteria</p>
                        <Textarea
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            rows={2}
                            className="resize-none text-sm border-slate-200"
                            placeholder="e.g. General Manager of 5-star hotel in Thailand with international chain experience"
                            disabled={status === "processing"}
                        />
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={handleAnalyse}
                                disabled={loading || status === "processing" || !query.trim() || !candidateIds.length}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                            >
                                {status === "processing"
                                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analysing...</>
                                    : <><Sparkles className="w-4 h-4 mr-2" />Analyse &amp; Rank {candidateIds.length} Candidates</>
                                }
                            </Button>
                            {status !== "idle" && (
                                <Button variant="outline" size="icon" onClick={handleReset} title="Reset">
                                    <RotateCcw className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Processing state */}
                    {status === "processing" && !data?.results.length && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-8 text-center space-y-3">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-400" />
                            <p className="text-sm font-medium text-indigo-700">
                                {pollingStatus === "ready_to_analyse" && "รอ AI เริ่มประเมิน..."}
                                {pollingStatus === "analysing" && `AI กำลังประเมิน ${candidateCount ? `${candidateCount} candidates` : "candidates"}...`}
                                {pollingStatus === "pending_summary" && "AI กำลังสรุปผลและจัดอันดับ..."}
                                {!pollingStatus && `กำลังส่งข้อมูลไปยัง n8n...`}
                            </p>
                            <p className="text-xs text-indigo-400">ระบบประมวลผลทีละคน — ผลทยอยแสดงขึ้นมาเรื่อยๆ</p>
                        </div>
                    )}

                    {/* Error */}
                    {status === "error" && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
                            ⚠ {errorMsg ?? "เกิดข้อผิดพลาด กรุณาลองใหม่"}
                        </div>
                    )}

                    {/* Results */}
                    {data && data.results.length > 0 && (
                        <div className="space-y-4">
                            {/* Summary banner */}
                            {status === "completed" && data.summary?.final_recommendation && (
                                <div className="bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-100 rounded-xl p-4 space-y-2">
                                    <p className="text-sm font-bold text-indigo-900 leading-relaxed">
                                        ✦ {data.summary.final_recommendation}
                                    </p>
                                    {data.summary.highlights?.map((h, i) => (
                                        <p key={i} className="text-xs text-slate-600 leading-relaxed">• {h}</p>
                                    ))}
                                </div>
                            )}

                            {/* Processing: show progress */}
                            {status === "processing" && (
                                <div className="flex items-center gap-2 text-xs text-indigo-600 font-medium">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    {data.results.length} / {candidateCount ?? "?"} candidates evaluated...
                                </div>
                            )}

                            {/* All results — category buttons + ranked list */}
                            {sortedResults.length > 0 && (
                                <div className="space-y-3">
                                    {status === "completed" && avgScores && (
                                        <div className="flex gap-2 overflow-x-auto pb-1">
                                            {CATEGORIES.map(cat => (
                                                <CategoryButton
                                                    key={cat.key}
                                                    cat={cat}
                                                    avgScore={avgScores[cat.key]}
                                                    active={activeCategory === cat.key}
                                                    onClick={() => setActiveCategory(cat.key)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between px-1">
                                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                            {status === "processing"
                                                ? <><span className="text-indigo-500">{sortedResults.length}</span> / {candidateCount ?? "?"} evaluated</>
                                                : <>{sortedResults.length} Candidates Ranked{activeCategory !== "overall" && <span className="text-indigo-500"> • {CATEGORIES.find(c => c.key === activeCategory)?.label}</span>}</>
                                            }
                                        </span>
                                        <span className="text-xs text-slate-400">Click row for detail</span>
                                    </div>
                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        {sortedResults.map((r, idx) => (
                                            <ResultRow key={r.candidate_id} r={r} activeCategory={activeCategory} displayRank={idx + 1} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
