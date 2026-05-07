"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Sparkles, Loader2, RotateCcw, ChevronDown, ChevronUp, Briefcase, Target, Globe, Wrench, BarChart3, History, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { triggerStage3Ranking, getStage3JobStatus, getLatestJobForJR, getJobHistoryForJR, type Stage3JobData, type Stage3Result, type JobHistoryItem } from "@/app/actions/ai-ranking";

interface Props {
    jrId: string;
    jrTitle?: string;
}

// ── Category definitions ────────────────────────
type CategoryKey = "overall" | "experience" | "leadership" | "market" | "skills";

const CATEGORIES: { key: CategoryKey; label: string; icon: typeof Sparkles; color: string; bgColor: string; borderColor: string; scoreKey?: keyof Stage3Result; summaryKey?: keyof Stage3Result; max: number }[] = [
    { key: "overall",    label: "Overall",                icon: BarChart3, color: "text-indigo-600",  bgColor: "bg-indigo-50",  borderColor: "border-indigo-200", max: 100 },
    { key: "experience", label: "Experience & Expertise",  icon: Briefcase, color: "text-emerald-600", bgColor: "bg-emerald-50", borderColor: "border-emerald-200", scoreKey: "experience_score", summaryKey: "experience_summary", max: 25 },
    { key: "leadership", label: "Strategic Leadership",    icon: Target,    color: "text-violet-600",  bgColor: "bg-violet-50",  borderColor: "border-violet-200", scoreKey: "leadership_score", summaryKey: "leadership_summary", max: 25 },
    { key: "market",     label: "Market & Networking",     icon: Globe,     color: "text-sky-600",     bgColor: "bg-sky-50",     borderColor: "border-sky-200",    scoreKey: "market_score",     summaryKey: "market_summary",     max: 25 },
    { key: "skills",     label: "Skill Set",               icon: Wrench,    color: "text-orange-600",  bgColor: "bg-orange-50",  borderColor: "border-orange-200", scoreKey: "skills_score",     summaryKey: "skills_summary",     max: 25 },
];

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
    const style = rank === 1 ? "bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-amber-200 shadow-sm" :
                  rank <= 3 ? "bg-gradient-to-br from-slate-200 to-slate-300 text-slate-700" :
                  "bg-slate-100 text-slate-500";
    return (
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${style}`}>
            {rank}
        </div>
    );
}

// ── Category Button ─────────────────────────────
function CategoryButton({ cat, avgScore, active, onClick }: {
    cat: typeof CATEGORIES[number];
    avgScore: number | null;
    active: boolean;
    onClick: () => void;
}) {
    const Icon = cat.icon;
    return (
        <button
            onClick={onClick}
            className={`
                flex flex-col gap-1.5 px-4 py-3 rounded-xl border-2 transition-all duration-200 min-w-[140px] text-left
                ${active
                    ? `${cat.bgColor} ${cat.borderColor} shadow-md ring-1 ring-offset-1 ${cat.borderColor.replace("border-", "ring-")}`
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
                            className={`h-full rounded-full transition-all duration-500 ${
                                active
                                    ? cat.color.replace("text-", "bg-")
                                    : "bg-slate-300"
                            }`}
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
    if (!summary) return <p className="text-xs text-slate-400 italic py-1">ยังไม่มีข้อมูลเชิงลึก</p>;

    const bullets = summary.split("|").map(b => b.trim()).filter(Boolean);
    return (
        <div className="space-y-1.5 py-1">
            {bullets.map((b, i) => {
                const isWarning = b.includes("⚠️") || b.includes("⚠");
                return (
                    <p key={i} className={`text-xs leading-relaxed ${isWarning ? "text-amber-700" : "text-slate-700"}`}>
                        {b}
                    </p>
                );
            })}
        </div>
    );
}

// ── Result Row ──────────────────────────────────
function ResultRow({ r, activeCategory, displayRank }: { r: Stage3Result; activeCategory: CategoryKey; displayRank: number }) {
    const [expanded, setExpanded] = useState(false);
    const cat = CATEGORIES.find(c => c.key === activeCategory)!;

    // Determine what content to show based on active category
    const displayScore = activeCategory === "overall" ? r.score :
        (r[cat.scoreKey as keyof Stage3Result] as number | null) ?? null;
    const displayMax = cat.max;

    const displaySummary = activeCategory === "overall"
        ? (r.strengths || "") + (r.gaps ? ` | ⚠️ ${r.gaps}` : "") + (r.tradeoff ? ` | ↔ ${r.tradeoff}` : "")
        : (r[cat.summaryKey as keyof Stage3Result] as string | null);

    // Category mini scores for the right side
    const miniScores = CATEGORIES.filter(c => c.key !== "overall" && c.scoreKey).map(c => ({
        ...c,
        value: (r[c.scoreKey as keyof Stage3Result] as number | null),
    }));

    const has4DimData = r.experience_score !== null;

    return (
        <div className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
            <div
                className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                onClick={() => setExpanded(v => !v)}
            >
                <RankBadge rank={displayRank} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-semibold text-slate-900">{r.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${
                            r.list_type === "Top Profile"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-500"
                        }`}>
                            {r.list_type === "Top Profile" ? "★ Top Profile" : "Longlist"}
                        </span>
                    </div>
                    {(r.position || r.company) && (
                        <p className="text-xs text-slate-500 truncate">
                            {[r.position, r.company].filter(Boolean).join(" @ ")}
                        </p>
                    )}

                    {/* 4D Score Badges — prominent, scannable at first glance */}
                    {activeCategory === "overall" && has4DimData && (
                        <div className="flex gap-2 mt-2.5 flex-wrap">
                            {miniScores.map(ms => ms.value !== null && (
                                <div key={ms.key}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${ms.bgColor} border ${ms.borderColor}`}
                                >
                                    <span className={`text-xs font-semibold ${ms.color}`}>{ms.label.split(" ")[0]}</span>
                                    <span className={`text-base font-extrabold tabular-nums ${ms.color}`}>{ms.value}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Category-specific summary preview */}
                    {activeCategory !== "overall" && displaySummary && (
                        <div className="mt-1">
                            <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                                {displaySummary.split("|")[0]?.trim()}
                            </p>
                        </div>
                    )}
                    {activeCategory === "overall" && (
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">{r.strengths}</p>
                    )}

                    {/* Expanded detail */}
                    {expanded && (
                        <div className="mt-2 pt-2 border-t border-slate-100">
                            {activeCategory === "overall" ? (
                                <div className="space-y-1.5">
                                    {r.gaps && <p className="text-xs text-rose-500 leading-relaxed">⚠ {r.gaps}</p>}
                                    {r.tradeoff && <p className="text-xs text-slate-500 italic leading-relaxed">↔ {r.tradeoff}</p>}

                                    {/* Show all 4 dimensions when expanded in overall mode */}
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
                                                            {catScore !== null && (
                                                                <span className={`text-xs font-bold ${c.color}`}>{catScore}/25</span>
                                                            )}
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
                    {expanded
                        ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                        : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    }
                </div>
            </div>
        </div>
    );
}

// ── Original Result Row (for non-Top-20 — same as old UI) ──
function OriginalResultRow({ r }: { r: Stage3Result }) {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
            <div
                className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                onClick={() => setExpanded(v => !v)}
            >
                <RankBadge rank={r.rank} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-semibold text-slate-900">{r.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${
                            r.list_type === "Top Profile"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-500"
                        }`}>
                            {r.list_type === "Top Profile" ? "★ Top Profile" : "Longlist"}
                        </span>
                    </div>
                    {(r.position || r.company) && (
                        <p className="text-xs text-slate-500 truncate">
                            {[r.position, r.company].filter(Boolean).join(" @ ")}
                        </p>
                    )}
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">{r.strengths}</p>
                    {expanded && (
                        <div className="mt-2 space-y-1">
                            {r.gaps && (
                                <p className="text-xs text-rose-500 leading-relaxed">⚠ {r.gaps}</p>
                            )}
                            {r.tradeoff && (
                                <p className="text-xs text-slate-500 italic leading-relaxed">↔ {r.tradeoff}</p>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0 mt-0.5">
                    <ScoreBar score={r.score} />
                    {expanded
                        ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                        : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    }
                </div>
            </div>
        </div>
    );
}

// ── Main Component ──────────────────────────────
export function AiSuggestionTab({ jrId, jrTitle }: Props) {
    const [query, setQuery] = useState(jrTitle ?? "");
    const [status, setStatus] = useState<"idle" | "processing" | "completed" | "error">("idle");
    const [pollingStatus, setPollingStatus] = useState<string | null>(null);
    const [data, setData] = useState<Stage3JobData | null>(null);
    const [candidateCount, setCandidateCount] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<CategoryKey>("overall");
    const [history, setHistory] = useState<JobHistoryItem[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const jobIdRef = useRef<string | null>(null);

    const stopPolling = () => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };

    useEffect(() => () => stopPolling(), []);

    // Restore state when JR changes
    useEffect(() => {
        stopPolling();
        setStatus("idle");
        setData(null);
        setPollingStatus(null);
        setQuery(jrTitle ?? "");
        setErrorMsg(null);
        setActiveCategory("overall");
        setShowHistory(false);

        const restore = async () => {
            // Fetch history
            const hist = await getJobHistoryForJR(jrId);
            setHistory(hist);

            const job = await getLatestJobForJR(jrId);
            if (!job) return;
            setCandidateCount(job.candidateCount);
            setActiveJobId(job.jobId);
            if (job.status === "completed") {
                const result = await getStage3JobStatus(job.jobId, jrId);
                if (result) { setStatus("completed"); setData(result); }
            } else if (["ready_to_analyse", "analysing", "pending_summary"].includes(job.status)) {
                setStatus("processing");
                setPollingStatus(job.status);
                startPolling(job.jobId);
            }
        };
        restore();
    }, [jrId, jrTitle]);

    const startPolling = (jobId: string) => {
        jobIdRef.current = jobId;
        pollRef.current = setInterval(async () => {
            try {
                const result = await getStage3JobStatus(jobId, jrId);
                if (!result) {
                    stopPolling();
                    setStatus("error");
                    setErrorMsg("ไม่พบข้อมูล job");
                } else {
                    setPollingStatus(result.status);
                    if (result.results.length > 0) setData(result);
                    if (result.status === "completed") {
                        stopPolling();
                        setStatus("completed");
                    }
                }
            } catch {
                stopPolling();
                setStatus("error");
                setErrorMsg("เกิดข้อผิดพลาดระหว่าง polling");
            }
        }, 4000);
    };

    const handleAnalyse = async () => {
        if (!query.trim()) return;
        stopPolling();
        setLoading(true);
        setStatus("processing");
        setPollingStatus(null);
        setData(null);
        setErrorMsg(null);
        setActiveCategory("overall");
        setShowHistory(false);
        try {
            const { jobId, candidateCount: cnt } = await triggerStage3Ranking(jrId, query.trim());
            setCandidateCount(cnt);
            setActiveJobId(jobId);
            startPolling(jobId);
            // Refresh history
            const hist = await getJobHistoryForJR(jrId);
            setHistory(hist);
        } catch (err: any) {
            setStatus("error");
            setErrorMsg(err.message ?? "เกิดข้อผิดพลาด");
        } finally {
            setLoading(false);
        }
    };

    const loadHistoryJob = async (jobId: string) => {
        stopPolling();
        setActiveJobId(jobId);
        setActiveCategory("overall");
        setShowHistory(false);
        setStatus("processing");
        setPollingStatus(null);
        try {
            const result = await getStage3JobStatus(jobId, jrId);
            if (result) {
                setData(result);
                setStatus(result.status === "completed" ? "completed" : "processing");
                if (result.status !== "completed") startPolling(jobId);
            }
        } catch {
            setStatus("error");
            setErrorMsg("ไม่สามารถโหลดผลวิเคราะห์ได้");
        }
    };

    // ── Split into Top 20 (with 4-dim) vs rest ──
    const { top20, restResults } = useMemo(() => {
        if (!data?.results) return { top20: [], restResults: [] };
        const t20 = data.results.filter(r => r.experience_score !== null);
        const rest = data.results.filter(r => r.experience_score === null);
        return { top20: t20, restResults: rest.sort((a, b) => b.score - a.score) };
    }, [data?.results]);

    // ── Sort Top 20 by active category ──
    const sortedTop20 = useMemo(() => {
        if (!top20.length) return [];
        const results = [...top20];
        if (activeCategory === "overall") {
            return results.sort((a, b) => b.score - a.score || a.rank - b.rank);
        }
        const cat = CATEGORIES.find(c => c.key === activeCategory);
        if (!cat?.scoreKey) return results;
        return results.sort((a, b) => {
            const sa = (a[cat.scoreKey as keyof Stage3Result] as number | null) ?? -1;
            const sb = (b[cat.scoreKey as keyof Stage3Result] as number | null) ?? -1;
            return sb - sa || a.rank - b.rank;
        });
    }, [top20, activeCategory]);

    // ── Compute average scores per category (Top 20 only) ──
    const avgScores = useMemo(() => {
        if (!top20.length) return null;
        return {
            overall: Math.round((top20.reduce((s, r) => s + r.score, 0) / top20.length) * 10) / 10,
            experience: Math.round((top20.reduce((s, r) => s + (r.experience_score ?? 0), 0) / top20.length) * 10) / 10,
            leadership: Math.round((top20.reduce((s, r) => s + (r.leadership_score ?? 0), 0) / top20.length) * 10) / 10,
            market: Math.round((top20.reduce((s, r) => s + (r.market_score ?? 0), 0) / top20.length) * 10) / 10,
            skills: Math.round((top20.reduce((s, r) => s + (r.skills_score ?? 0), 0) / top20.length) * 10) / 10,
        };
    }, [top20]);

    return (
        <div className="space-y-4 p-1">
            {/* Query input card */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">AI Criteria</span>
                </div>
                <Textarea
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    rows={2}
                    className="resize-none text-sm border-slate-200"
                    placeholder="เช่น General Manager of 5-star hotel in Thailand with international chain experience"
                />
                <div className="flex items-center gap-2">
                    <Button
                        onClick={handleAnalyse}
                        disabled={loading || status === "processing" || !query.trim()}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                    >
                        {status === "processing"
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analysing...</>
                            : <><Sparkles className="w-4 h-4 mr-2" />Analyse Candidates in this JR</>
                        }
                    </Button>
                    {history.length >= 1 && (
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setShowHistory(v => !v)}
                            title="ประวัติการวิเคราะห์"
                            className={showHistory ? "border-indigo-300 bg-indigo-50" : ""}
                        >
                            <History className="w-4 h-4" />
                        </Button>
                    )}
                    {status !== "idle" && (
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => { stopPolling(); setStatus("idle"); setData(null); setActiveCategory("overall"); }}
                            title="Reset"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </Button>
                    )}
                </div>

                {/* History panel */}
                {showHistory && history.length > 0 && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <div className="bg-slate-50 px-3 py-2 border-b border-slate-200">
                            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">ประวัติการวิเคราะห์</span>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                            {history.map(h => (
                                <button
                                    key={h.jobId}
                                    onClick={() => loadHistoryJob(h.jobId)}
                                    className={`w-full text-left px-3 py-2.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors ${
                                        activeJobId === h.jobId ? "bg-indigo-50 border-l-2 border-l-indigo-500" : ""
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs font-medium text-slate-800 truncate flex-1">{h.query}</p>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                                            h.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                        }`}>
                                            {h.status === "completed" ? "✓" : "..."}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <Clock className="w-3 h-3 text-slate-400" />
                                        <span className="text-[10px] text-slate-400">
                                            {new Date(h.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}
                                            {" "}
                                            {new Date(h.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                        {h.resultCount && <span className="text-[10px] text-slate-400">• {h.resultCount} candidates</span>}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Processing */}
            {status === "processing" && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-8 text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-400" />
                    <p className="text-sm font-medium text-indigo-700">
                        {pollingStatus === "ready_to_analyse" && "รอ AI เริ่มประเมิน..."}
                        {pollingStatus === "analysing" && `AI กำลังประเมิน ${candidateCount ? `${candidateCount} candidates` : "candidates"}...`}
                        {pollingStatus === "pending_summary" && "AI กำลังวิเคราะห์เชิงลึก Top 20 + สรุปผล..."}
                        {!pollingStatus && `AI กำลังประเมิน ${candidateCount ? `${candidateCount} candidates` : "candidates"}...`}
                    </p>
                    <p className="text-xs text-indigo-400">ระบบประมวลผลทุก 3 นาที อาจใช้เวลา 5–15 นาที</p>
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

                    {/* ════════════════════════════════════════════════════ */}
                    {/* ── TOP 20 Section: Category Buttons + Enhanced UI ── */}
                    {/* ════════════════════════════════════════════════════ */}
                    {sortedTop20.length > 0 && (
                        <div className="space-y-3">
                            {/* Category Filter Buttons */}
                            {status === "completed" && avgScores && (
                                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
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

                            {/* Top 20 header */}
                            <div className="flex items-center justify-between px-1">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                    {status === "processing"
                                        ? <>Evaluating... <span className="text-indigo-500">{data.results.length} done so far</span></>
                                        : <>Top {sortedTop20.length} — Deep-Dive Analysis {activeCategory !== "overall" && <span className="text-indigo-500">• sorted by {CATEGORIES.find(c => c.key === activeCategory)?.label}</span>}</>
                                    }
                                </span>
                                <span className="text-xs text-slate-400">คลิกแถวเพื่อดูรายละเอียด</span>
                            </div>

                            {/* Top 20 ranked list — with 4-dim features */}
                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                {sortedTop20.map((r, idx) => (
                                    <ResultRow key={r.candidate_id} r={r} activeCategory={activeCategory} displayRank={idx + 1} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ════════════════════════════════════════════════════ */}
                    {/* ── REST Section: Original simple list (unchanged)  ── */}
                    {/* ════════════════════════════════════════════════════ */}
                    {restResults.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                    Other Candidates ({restResults.length})
                                </span>
                                <span className="text-xs text-slate-400">คลิกแถวเพื่อดูรายละเอียด</span>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                {restResults.map(r => (
                                    <OriginalResultRow key={r.candidate_id} r={r} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* During processing, show all results in original format */}
                    {status === "processing" && sortedTop20.length === 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                    Evaluating... <span className="text-indigo-500">{data.results.length} done so far</span>
                                </span>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                {data.results.sort((a, b) => b.score - a.score).map(r => (
                                    <OriginalResultRow key={r.candidate_id} r={r} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

