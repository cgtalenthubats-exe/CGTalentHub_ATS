"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
    Sparkles, Loader2, ChevronDown, ChevronUp, ExternalLink,
    Briefcase, Target, Globe, Wrench, BarChart3,
    MapPin, Cake, Linkedin,
} from "lucide-react";
import {
    getSearchJobStatus,
    type SearchJobData, type SearchResult,
} from "@/app/actions/ai-search-ranking";
import { CandidateAvatar } from "@/components/candidate-avatar";
import { CandidateProfileSheet } from "@/components/candidate-profile-sheet";

interface Props {
    jobId: string | null;
}

// ── Category definitions ────────────────────────
type CategoryKey = "overall" | "experience" | "leadership" | "market" | "skills";

const CATEGORIES: {
    key: CategoryKey; label: string; icon: typeof Sparkles;
    color: string; bgColor: string; borderColor: string;
    scoreKey?: keyof SearchResult; summaryKey?: keyof SearchResult; max: number;
}[] = [
    { key: "overall",    label: "Overall",         icon: BarChart3, color: "text-indigo-600",  bgColor: "bg-indigo-50",  borderColor: "border-indigo-200", max: 100 },
    { key: "experience", label: "Experience",      icon: Briefcase, color: "text-emerald-600", bgColor: "bg-emerald-50", borderColor: "border-emerald-200", scoreKey: "experience_score", summaryKey: "experience_summary", max: 25 },
    { key: "leadership", label: "Leadership",      icon: Target,    color: "text-violet-600",  bgColor: "bg-violet-50",  borderColor: "border-violet-200", scoreKey: "leadership_score", summaryKey: "leadership_summary", max: 25 },
    { key: "market",     label: "Market & Network", icon: Globe,    color: "text-sky-600",     bgColor: "bg-sky-50",     borderColor: "border-sky-200",    scoreKey: "market_score",     summaryKey: "market_summary",     max: 25 },
    { key: "skills",     label: "Skill Set",       icon: Wrench,    color: "text-orange-600",  bgColor: "bg-orange-50",  borderColor: "border-orange-200", scoreKey: "skills_score",     summaryKey: "skills_summary",     max: 25 },
];

// ── Score Bar ───────────────────────────────────
function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
    const pct = Math.min(100, Math.round((score / max) * 100));
    const color = pct >= 75 ? "bg-emerald-500" : pct >= 55 ? "bg-amber-400" : "bg-rose-400";
    return (
        <div className="flex items-center gap-1.5">
            <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
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

// ── Candidate ID badge ──────────────────────────
function CandidateIdBadge({ candidateId, onClick }: { candidateId: string; onClick: () => void }) {
    return (
        <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-md px-1.5 py-0.5 transition-colors shrink-0"
        >
            {candidateId}
        </button>
    );
}

// ── Info Chip (age / address / linkedin) ────────
function InfoChip({ icon: Icon, label, value, href, className, valueClassName }: {
    icon: typeof MapPin; label: string; value: string; href?: string; className?: string; valueClassName?: string;
}) {
    const inner = (
        <div className={`flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-1.5 min-w-0 ${href ? "hover:bg-indigo-50 transition-colors" : ""} ${className ?? ""}`}>
            <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="min-w-0">
                <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide leading-none">{label}</p>
                <p className={`text-xs font-bold truncate ${valueClassName ?? 'text-slate-700'}`}>{value}</p>
            </div>
        </div>
    );
    if (href) {
        return (
            <a href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="min-w-0">
                {inner}
            </a>
        );
    }
    return inner;
}

// ── Candidate name + LinkedIn link ──────────────
function CandidateName({ r, className }: { r: SearchResult; className?: string }) {
    return (
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className={className}>{r.name}</span>
            {r.linkedin && (
                <a
                    href={r.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-slate-300 hover:text-indigo-600 transition-colors shrink-0"
                >
                    <ExternalLink className="w-3 h-3" />
                </a>
            )}
        </div>
    );
}

// ── Top 3 Card ───────────────────────────────────
function TopCard({ r, rank, activeCategory, onOpenProfile, isExpanded, onToggle, fullWidth = false }: {
    r: SearchResult; rank: number; activeCategory: CategoryKey;
    onOpenProfile: (candidateId: string) => void;
    isExpanded: boolean;
    onToggle: () => void;
    fullWidth?: boolean;
}) {
    const cat = CATEGORIES.find(c => c.key === activeCategory)!;
    const has4DimData = r.experience_score !== null;

    const displayScore = activeCategory === "overall"
        ? r.score
        : (r[cat.scoreKey as keyof SearchResult] as number | null) ?? r.score;
    const displayMax = activeCategory === "overall" ? 100 : cat.max;

    const medalStyle = rank === 1
        ? "bg-gradient-to-br from-amber-400 to-amber-500"
        : rank === 2
            ? "bg-gradient-to-br from-slate-300 to-slate-400"
            : "bg-gradient-to-br from-orange-300 to-orange-400";

    const dimDetails = has4DimData ? CATEGORIES.filter(c => c.key !== "overall" && c.summaryKey).map(c => ({
        ...c,
        summary: r[c.summaryKey as keyof SearchResult] as string | null,
    })) : [];

    return (
        <div
            className="relative bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={onToggle}
        >
            <div className={`absolute -top-2.5 -left-2.5 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow ${medalStyle}`}>
                {rank}
            </div>

            {/* Full-width expanded layout */}
            {fullWidth && isExpanded ? (
                <div className="flex flex-col gap-3">
                    {/* Header row */}
                    <div className="flex items-center gap-3">
                        <CandidateAvatar src={r.photo_url} name={r.name} className="h-16 w-16 ring-2 ring-slate-100 shrink-0" />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                                <CandidateName r={r} className="text-base font-bold text-slate-900 truncate" />
                                <CandidateIdBadge candidateId={r.candidate_id} onClick={() => onOpenProfile(r.candidate_id)} />
                            </div>
                            {(r.position || r.company) && (
                                <p className="text-sm font-semibold text-slate-600 leading-snug mt-0.5">
                                    {r.position}
                                    {r.company && <span className="text-slate-400 font-medium"> @ {r.company}</span>}
                                </p>
                            )}
                        </div>
                        {/* Score badge on the right */}
                        <div className="shrink-0 flex items-center gap-3">
                            <div className="text-right">
                                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{activeCategory === "overall" ? "Overall Score" : cat.label}</p>
                                <span className={`text-3xl font-extrabold tabular-nums ${activeCategory === "overall" ? "text-indigo-600" : cat.color}`}>
                                    {displayScore ?? "-"}<span className="text-xs text-slate-400 font-medium"> / {displayMax}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Info chips */}
                    {(r.age != null || r.address || r.linkedin) && (
                        <div className="flex flex-wrap gap-1.5">
                            {r.age != null && <InfoChip icon={Cake} label="Age" value={r.age_source === 'estimated' ? `Est. ${r.age}` : `${r.age} ปี`} valueClassName={r.age_source === 'estimated' ? 'text-red-500' : undefined} />}
                            {r.linkedin && <InfoChip icon={Linkedin} label="LinkedIn" value="View Profile" href={r.linkedin} />}
                            {r.address && <InfoChip icon={MapPin} label="Address" value={r.address} />}
                        </div>
                    )}

                    {/* 4 dim badges */}
                    {has4DimData && (
                        <div className="grid grid-cols-4 gap-1.5">
                            {CATEGORIES.filter(c => c.key !== "overall" && c.scoreKey).map(c => (
                                <div key={c.key} className={`flex flex-col items-center gap-0.5 rounded-lg py-1.5 ${c.bgColor} border ${c.borderColor}`}>
                                    <span className={`text-[10px] font-semibold ${c.color}`}>{c.label.split(" ")[0]}</span>
                                    <span className={`text-sm font-extrabold ${c.color}`}>{r[c.scoreKey as keyof SearchResult] as number}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Main body: 2-column */}
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                        {/* Left: strengths + gaps + tradeoff */}
                        <div className="space-y-2">
                            {r.strengths && <p className="text-xs text-slate-600 leading-relaxed">{r.strengths}</p>}
                            {r.gaps && <p className="text-xs text-rose-500 leading-relaxed">⚠ {r.gaps}</p>}
                            {r.tradeoff && <p className="text-xs text-slate-500 italic leading-relaxed">↔ {r.tradeoff}</p>}
                        </div>
                        {/* Right: dimension detail boxes in 2x2 */}
                        {dimDetails.length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                                {dimDetails.map(c => {
                                    const Icon = c.icon;
                                    return (
                                        <div key={c.key} className={`p-2.5 rounded-lg ${c.bgColor} border ${c.borderColor}`}>
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <Icon className={`w-3 h-3 ${c.color}`} />
                                                <span className={`text-[11px] font-semibold ${c.color}`}>{c.label}</span>
                                            </div>
                                            <BulletInsights summary={c.summary} />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-center">
                        <ChevronUp className="w-3.5 h-3.5 text-slate-300" />
                    </div>
                </div>
            ) : (
                /* Collapsed / non-full-width layout */
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <CandidateAvatar src={r.photo_url} name={r.name} className="h-16 w-16 ring-2 ring-slate-100 shrink-0" />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                                <CandidateName r={r} className="text-base font-bold text-slate-900 truncate" />
                                <CandidateIdBadge candidateId={r.candidate_id} onClick={() => onOpenProfile(r.candidate_id)} />
                            </div>
                            {(r.position || r.company) && (
                                <p className="text-sm font-semibold text-slate-600 leading-snug mt-0.5">
                                    {r.position}
                                    {r.company && <span className="text-slate-400 font-medium"> @ {r.company}</span>}
                                </p>
                            )}
                        </div>
                    </div>

                    {(r.age != null || r.address || r.linkedin) && (
                        <div className="grid grid-cols-2 gap-1.5">
                            {r.age != null && <InfoChip icon={Cake} label="Age" value={r.age_source === 'estimated' ? `Est. ${r.age}` : `${r.age} ปี`} valueClassName={r.age_source === 'estimated' ? 'text-red-500' : undefined} />}
                            {r.linkedin && <InfoChip icon={Linkedin} label="LinkedIn" value="View Profile" href={r.linkedin} />}
                            {r.address && <InfoChip icon={MapPin} label="Address" value={r.address} className="col-span-2" />}
                        </div>
                    )}

                    <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                            {activeCategory === "overall" ? "Overall Score" : cat.label}
                        </span>
                        <span className={`text-2xl font-extrabold tabular-nums ${activeCategory === "overall" ? "text-indigo-600" : cat.color}`}>
                            {displayScore ?? "-"}<span className="text-xs text-slate-400 font-medium"> / {displayMax}</span>
                        </span>
                    </div>

                    {has4DimData && (
                        <div className="grid grid-cols-4 gap-1.5">
                            {CATEGORIES.filter(c => c.key !== "overall" && c.scoreKey).map(c => (
                                <div key={c.key} className={`flex flex-col items-center gap-0.5 rounded-lg py-1.5 ${c.bgColor} border ${c.borderColor}`}>
                                    <span className={`text-[10px] font-semibold ${c.color}`}>{c.label.split(" ")[0]}</span>
                                    <span className={`text-sm font-extrabold ${c.color}`}>{r[c.scoreKey as keyof SearchResult] as number}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {r.strengths && <p className="text-xs text-slate-600 leading-relaxed">{r.strengths}</p>}

                    <div className="flex justify-center">
                        <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Result Row ──────────────────────────────────
function ResultRow({ r, activeCategory, displayRank, onOpenProfile }: { r: SearchResult; activeCategory: CategoryKey; displayRank: number; onOpenProfile: (candidateId: string) => void }) {
    const [expanded, setExpanded] = useState(false);
    const cat = CATEGORIES.find(c => c.key === activeCategory)!;

    const displayScore = activeCategory === "overall" ? r.score :
        (r[cat.scoreKey as keyof SearchResult] as number | null) ?? null;
    const displayMax = cat.max;

    const displaySummary = activeCategory === "overall"
        ? null
        : (r[cat.summaryKey as keyof SearchResult] as string | null);

    const miniScores = CATEGORIES.filter(c => c.key !== "overall" && c.scoreKey).map(c => ({
        ...c, value: (r[c.scoreKey as keyof SearchResult] as number | null),
    }));

    const has4DimData = r.experience_score !== null;

    return (
        <div className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
            <div className="flex items-start gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded(v => !v)}>
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <RankBadge rank={displayRank} />
                    <CandidateAvatar src={r.photo_url} name={r.name} className="h-8 w-8" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <CandidateName r={r} className="text-sm font-semibold text-slate-900" />
                        <CandidateIdBadge candidateId={r.candidate_id} onClick={() => onOpenProfile(r.candidate_id)} />
                    </div>
                    {(r.position || r.company) && (
                        <p className="text-xs text-slate-500 truncate">{[r.position, r.company].filter(Boolean).join(" @ ")}</p>
                    )}
                    {(r.age != null || r.address) && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-slate-400">
                            {r.age != null && <span className={r.age_source === 'estimated' ? 'text-red-500' : undefined}>{r.age_source === 'estimated' ? `Est. ${r.age}` : `${r.age} ปี`}</span>}
                            {r.address && <span className="truncate">{r.address}</span>}
                        </div>
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
                                                const catSummary = r[c.summaryKey as keyof SearchResult] as string | null;
                                                const catScore = r[c.scoreKey as keyof SearchResult] as number | null;
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

// ── Main Component ──────────────────────────────
export function Stage3ResultsPanel({ jobId }: Props) {
    const [status, setStatus] = useState<"idle" | "loading" | "completed" | "error">("idle");
    const [pollingStatus, setPollingStatus] = useState<string | null>(null);
    const [data, setData] = useState<SearchJobData | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<CategoryKey>("overall");
    const [profileCandidateId, setProfileCandidateId] = useState<string | null>(null);
    const [expandedTopRank, setExpandedTopRank] = useState<number | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopPolling = () => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
    useEffect(() => () => stopPolling(), []);

    useEffect(() => {
        stopPolling();
        setData(null);
        setErrorMsg(null);
        setPollingStatus(null);
        setActiveCategory("overall");
        setExpandedTopRank(null);

        if (!jobId) {
            setStatus("idle");
            return;
        }

        setStatus("loading");

        const fetchOnce = async () => {
            try {
                const result = await getSearchJobStatus(jobId);
                if (!result) {
                    stopPolling(); setStatus("error"); setErrorMsg("ไม่พบข้อมูล job");
                    return;
                }
                setPollingStatus(result.status);
                if (result.results.length > 0) setData(result);
                if (result.status === "completed") {
                    stopPolling(); setStatus("completed");
                }
            } catch {
                stopPolling(); setStatus("error"); setErrorMsg("เกิดข้อผิดพลาดระหว่าง polling");
            }
        };

        fetchOnce();
        pollRef.current = setInterval(fetchOnce, 4000);

        return () => stopPolling();
    }, [jobId]);

    const sortedResults = useMemo(() => {
        if (!data?.results?.length) return [];
        const results = [...data.results];
        if (activeCategory === "overall") return results.sort((a, b) => b.score - a.score || (a.rank ?? 999) - (b.rank ?? 999));
        const cat = CATEGORIES.find(c => c.key === activeCategory);
        if (!cat?.scoreKey) return results;
        return results.sort((a, b) => {
            const sa = (a[cat.scoreKey as keyof SearchResult] as number | null) ?? -1;
            const sb = (b[cat.scoreKey as keyof SearchResult] as number | null) ?? -1;
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

    if (!jobId) return null;

    const topResults = sortedResults.slice(0, 3);
    const restResults = sortedResults.slice(3);

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2.5 px-5 py-4">
                <div className="p-1.5 bg-indigo-100 rounded-lg">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-800">AI Ranking — Top 20</p>
                        {status === "loading" && !data?.results.length && (
                            <span className="text-xs text-indigo-600 flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                {pollingStatus === "ready_to_analyse" && "รอ AI เริ่มประเมิน..."}
                                {pollingStatus === "analysing" && "AI กำลังประเมิน..."}
                                {pollingStatus === "pending_summary" && "AI กำลังสรุปผลและจัดอันดับ..."}
                                {!pollingStatus && "กำลังโหลด..."}
                            </span>
                        )}
                        {status === "loading" && (data?.results.length ?? 0) > 0 && (
                            <span className="text-xs text-indigo-600 flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                {data?.results.length} / {data?.result_count ?? "?"} evaluated...
                            </span>
                        )}
                        {status === "error" && <span className="text-xs text-rose-500">{errorMsg ?? "Error"}</span>}
                    </div>
                    {data?.query && (
                        <p className="text-base font-medium text-slate-700 mt-1 leading-snug">
                            {data.query}
                        </p>
                    )}
                </div>
            </div>

            <div className="border-t border-slate-100 p-4 space-y-4">
                {/* Empty / waiting state */}
                {!data?.results.length && status === "loading" && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-8 text-center space-y-3">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-400" />
                        <p className="text-sm font-medium text-indigo-700">กำลังประมวลผล...</p>
                        <p className="text-xs text-indigo-400">ระบบประมวลผลทีละคน — ผลทยอยแสดงขึ้นมาเรื่อยๆ</p>
                    </div>
                )}

                {/* Results */}
                {sortedResults.length > 0 && (
                    <div className="space-y-4">
                        {/* Top 3 — visual cards */}
                        {expandedTopRank !== null ? (
                            <div className="space-y-3">
                                {/* Expanded card — full width */}
                                <TopCard
                                    key={topResults[expandedTopRank - 1]?.candidate_id}
                                    r={topResults[expandedTopRank - 1]}
                                    rank={expandedTopRank}
                                    activeCategory={activeCategory}
                                    onOpenProfile={setProfileCandidateId}
                                    isExpanded={true}
                                    onToggle={() => setExpandedTopRank(null)}
                                    fullWidth={true}
                                />
                                {/* Other 2 — side by side */}
                                <div className="grid grid-cols-2 gap-3">
                                    {topResults
                                        .filter((_, i) => i + 1 !== expandedTopRank)
                                        .map((r, _) => {
                                            const rank = topResults.indexOf(r) + 1;
                                            return (
                                                <TopCard
                                                    key={r.candidate_id}
                                                    r={r}
                                                    rank={rank}
                                                    activeCategory={activeCategory}
                                                    onOpenProfile={setProfileCandidateId}
                                                    isExpanded={false}
                                                    onToggle={() => setExpandedTopRank(rank)}
                                                />
                                            );
                                        })}
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {topResults.map((r, idx) => (
                                    <TopCard
                                        key={r.candidate_id}
                                        r={r}
                                        rank={idx + 1}
                                        activeCategory={activeCategory}
                                        onOpenProfile={setProfileCandidateId}
                                        isExpanded={false}
                                        onToggle={() => setExpandedTopRank(idx + 1)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Summary banner */}
                        {status === "completed" && data?.summary?.final_recommendation && (
                            <div className="bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-100 rounded-xl p-4 space-y-2">
                                <p className="text-sm font-bold text-indigo-900 leading-relaxed">
                                    ✦ {data.summary.final_recommendation}
                                </p>
                                {data.summary.highlights?.map((h, i) => (
                                    <p key={i} className="text-xs text-slate-600 leading-relaxed">• {h}</p>
                                ))}
                            </div>
                        )}

                        {/* Category score tabs */}
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

                        {/* Remaining candidates list */}
                        {restResults.length > 0 && (
                            <>
                                <div className="flex items-center justify-between px-1">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        {status === "loading"
                                            ? <><span className="text-indigo-500">{sortedResults.length}</span> / {data?.result_count ?? "?"} evaluated</>
                                            : <>{sortedResults.length} Candidates Ranked{activeCategory !== "overall" && <span className="text-indigo-500"> • {CATEGORIES.find(c => c.key === activeCategory)?.label}</span>}</>
                                        }
                                    </span>
                                    <span className="text-xs text-slate-400">Click row for detail</span>
                                </div>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    {restResults.map((r, idx) => (
                                        <ResultRow key={r.candidate_id} r={r} activeCategory={activeCategory} displayRank={idx + 4} onOpenProfile={setProfileCandidateId} />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            <CandidateProfileSheet
                candidateId={profileCandidateId}
                open={!!profileCandidateId}
                onOpenChange={(open) => { if (!open) setProfileCandidateId(null); }}
            />
        </div>
    );
}
