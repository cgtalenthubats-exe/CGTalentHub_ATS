"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Sparkles, Loader2, RotateCcw, ChevronDown, ChevronUp, Briefcase, Target, Globe, Wrench, BarChart3, History, Clock, MessageSquare, Send, Bot, User, MapPin, Cake, Linkedin, ExternalLink, Download } from "lucide-react";
import { CandidateAvatar } from "@/components/candidate-avatar";
import { CandidateProfileSheet } from "@/components/candidate-profile-sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { triggerStage3Ranking, getStage3JobStatus, getLatestJobForJR, getJobHistoryForJR, type Stage3JobData, type Stage3Result, type JobHistoryItem } from "@/app/actions/ai-ranking";
import { sendJrChatMessage, getJrChatHistory } from "@/app/actions/jr-ai-chat";
import { generateAssessmentPPTX } from "@/app/actions/export-pptx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
    jrId: string;
    jrTitle?: string;
    jrDescription?: string;
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
                <p className={`text-xs font-bold truncate ${valueClassName ?? "text-slate-700"}`}>{value}</p>
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
function CandidateName({ r, className }: { r: Stage3Result; className?: string }) {
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

// ── Top 3 Card ────────────────────────────────────
function TopCard({ r, rank, activeCategory, onOpenProfile, isExpanded, onToggle, fullWidth = false }: {
    r: Stage3Result; rank: number; activeCategory: CategoryKey;
    onOpenProfile: (candidateId: string) => void;
    isExpanded: boolean;
    onToggle: () => void;
    fullWidth?: boolean;
}) {
    const cat = CATEGORIES.find(c => c.key === activeCategory)!;
    const has4DimData = r.experience_score !== null;

    const displayScore = activeCategory === "overall"
        ? r.score
        : (r[cat.scoreKey as keyof Stage3Result] as number | null) ?? r.score;
    const displayMax = activeCategory === "overall" ? 100 : cat.max;

    const medalStyle = rank === 1
        ? "bg-gradient-to-br from-amber-400 to-amber-500"
        : rank === 2
            ? "bg-gradient-to-br from-slate-300 to-slate-400"
            : "bg-gradient-to-br from-orange-300 to-orange-400";

    const dimDetails = has4DimData ? CATEGORIES.filter(c => c.key !== "overall" && c.summaryKey).map(c => ({
        ...c,
        summary: r[c.summaryKey as keyof Stage3Result] as string | null,
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
                        <div className="shrink-0 flex items-center gap-3">
                            <div className="text-right">
                                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{activeCategory === "overall" ? "Overall Score" : cat.label}</p>
                                <span className={`text-3xl font-extrabold tabular-nums ${activeCategory === "overall" ? "text-indigo-600" : cat.color}`}>
                                    {displayScore ?? "-"}<span className="text-xs text-slate-400 font-medium"> / {displayMax}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {(r.age != null || r.address || r.linkedin) && (
                        <div className="flex flex-wrap gap-1.5">
                            {r.age != null && <InfoChip icon={Cake} label="Age" value={`${r.age} ปี`} valueClassName={r.age_source === "estimated" ? "text-red-500" : undefined} />}
                            {r.linkedin && <InfoChip icon={Linkedin} label="LinkedIn" value="View Profile" href={r.linkedin} />}
                            {r.address && <InfoChip icon={MapPin} label="Address" value={r.address} />}
                        </div>
                    )}

                    {has4DimData && (
                        <div className="grid grid-cols-4 gap-1.5">
                            {CATEGORIES.filter(c => c.key !== "overall" && c.scoreKey).map(c => (
                                <div key={c.key} className={`flex flex-col items-center gap-0.5 rounded-lg py-1.5 ${c.bgColor} border ${c.borderColor}`}>
                                    <span className={`text-[10px] font-semibold ${c.color}`}>{c.label.split(" ")[0]}</span>
                                    <span className={`text-sm font-extrabold ${c.color}`}>{r[c.scoreKey as keyof Stage3Result] as number}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                        <div className="space-y-2">
                            {r.strengths && <p className="text-xs text-slate-600 leading-relaxed">{r.strengths}</p>}
                            {r.gaps && <p className="text-xs text-rose-500 leading-relaxed">⚠ {r.gaps}</p>}
                            {r.tradeoff && <p className="text-xs text-slate-500 italic leading-relaxed">↔ {r.tradeoff}</p>}
                        </div>
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
                            {r.age != null && <InfoChip icon={Cake} label="Age" value={`${r.age} ปี`} valueClassName={r.age_source === "estimated" ? "text-red-500" : undefined} />}
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
                                    <span className={`text-sm font-extrabold ${c.color}`}>{r[c.scoreKey as keyof Stage3Result] as number}</span>
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

// ── Top 3 Section wrapper (needs own state) ──────
function Top3Section({ results, activeCategory, onOpenProfile }: {
    results: Stage3Result[]; activeCategory: CategoryKey; onOpenProfile: (id: string) => void;
}) {
    const [expandedRank, setExpandedRank] = useState<number | null>(null);
    const top3 = results.slice(0, 3);

    if (expandedRank !== null) {
        const expanded = top3[expandedRank - 1];
        const others = top3.filter((_, i) => i + 1 !== expandedRank);
        return (
            <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">Top 3 Candidates</span>
                <TopCard
                    r={expanded} rank={expandedRank} activeCategory={activeCategory}
                    onOpenProfile={onOpenProfile}
                    isExpanded={true}
                    onToggle={() => setExpandedRank(null)}
                    fullWidth
                />
                <div className="grid grid-cols-2 gap-2">
                    {others.map((r) => {
                        const rank = top3.indexOf(r) + 1;
                        return (
                            <TopCard
                                key={r.candidate_id}
                                r={r} rank={rank} activeCategory={activeCategory}
                                onOpenProfile={onOpenProfile}
                                isExpanded={false}
                                onToggle={() => setExpandedRank(rank)}
                            />
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">Top 3 Candidates</span>
            <div className="grid grid-cols-3 gap-2">
                {top3.map((r, i) => (
                    <TopCard
                        key={r.candidate_id}
                        r={r} rank={i + 1} activeCategory={activeCategory}
                        onOpenProfile={onOpenProfile}
                        isExpanded={false}
                        onToggle={() => setExpandedRank(i + 1)}
                    />
                ))}
            </div>
        </div>
    );
}

// ── Result Row ──────────────────────────────────
function ResultRow({ r, activeCategory, displayRank, onOpenProfile }: { r: Stage3Result; activeCategory: CategoryKey; displayRank: number; onOpenProfile: (id: string) => void }) {
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
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <RankBadge rank={displayRank} />
                    <CandidateAvatar src={r.photo_url} name={r.name} className="h-8 w-8" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <CandidateName r={r} className="text-sm font-semibold text-slate-900" />
                        <CandidateIdBadge candidateId={r.candidate_id} onClick={() => onOpenProfile(r.candidate_id)} />
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

// ── Chat Message Types ──────────────────────────
type ChatMessage = { role: "user" | "ai"; text: string; id: number };

// ── Chat Section ────────────────────────────────
function ChatSection({ jrId, jrTitle }: { jrId: string; jrTitle?: string }) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const msgIdRef = useRef(0);

    // Load history when JR changes
    useEffect(() => {
        setMessages([]);
        setInput("");
        setError(null);
        setHistoryLoading(true);
        getJrChatHistory(jrId).then(history => {
            if (history.length > 0) {
                setMessages(history.map(h => ({ role: h.role, text: h.text, id: ++msgIdRef.current })));
            }
        }).finally(() => setHistoryLoading(false));
    }, [jrId]);

    // Auto-scroll to bottom
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    const handleSend = async () => {
        const text = input.trim();
        if (!text || loading) return;

        const userMsg: ChatMessage = { role: "user", text, id: ++msgIdRef.current };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setError(null);
        setLoading(true);

        try {
            const { answer } = await sendJrChatMessage(text, jrId, jrTitle ?? jrId);
            const aiMsg: ChatMessage = { role: "ai", text: answer, id: ++msgIdRef.current };
            setMessages(prev => [...prev, aiMsg]);
        } catch (err: any) {
            setError(err.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-[520px]">
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {historyLoading && (
                    <div className="flex items-center justify-center h-full gap-2 text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-xs">กำลังโหลดประวัติการสนทนา...</span>
                    </div>
                )}

                {messages.length === 0 && !loading && !historyLoading && (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
                        <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center">
                            <Bot className="w-6 h-6 text-indigo-400" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-slate-700">ถามเกี่ยวกับ Candidates ใน JR นี้ได้เลย</p>
                            <p className="text-xs text-slate-400">เช่น "มีใครมีประสบการณ์ 5-star hotel บ้าง?" หรือ "เปรียบเทียบ [ชื่อ] กับ [ชื่อ]"</p>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center mt-2">
                            {["แสดงรายชื่อ candidates ทั้งหมด", "ใครมี GM experience บ้าง?", "สรุปจุดเด่นของแต่ละคน"].map(s => (
                                <button
                                    key={s}
                                    onClick={() => { setInput(s); inputRef.current?.focus(); }}
                                    className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map(msg => (
                    <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            msg.role === "user" ? "bg-indigo-600" : "bg-slate-100"
                        }`}>
                            {msg.role === "user"
                                ? <User className="w-3.5 h-3.5 text-white" />
                                : <Bot className="w-3.5 h-3.5 text-slate-500" />
                            }
                        </div>
                        {msg.role === "user" ? (
                            <div className="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap bg-indigo-600 text-white rounded-tr-sm">
                                {msg.text}
                            </div>
                        ) : (
                            <div className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed bg-slate-100 text-slate-800 rounded-tl-sm prose prose-sm prose-slate max-w-none
                                prose-p:my-1 prose-headings:mt-2 prose-headings:mb-1 prose-headings:font-bold
                                prose-ul:my-1 prose-ol:my-1 prose-li:my-0
                                prose-table:text-xs prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1
                                prose-strong:font-bold prose-code:text-xs prose-code:bg-slate-200 prose-code:px-1 prose-code:rounded">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {msg.text}
                                </ReactMarkdown>
                            </div>
                        )}
                    </div>
                ))}

                {loading && (
                    <div className="flex gap-2.5 flex-row">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                            <Bot className="w-3.5 h-3.5 text-slate-500" />
                        </div>
                        <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-3.5 py-3 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
                        </div>
                    </div>
                )}

                {error && (
                    <div className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2">⚠ {error}</div>
                )}

                <div ref={bottomRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-slate-200 p-3 bg-white rounded-b-xl">
                <div className="flex gap-2 items-end">
                    <Textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="พิมพ์คำถามเกี่ยวกับ candidates ใน JR นี้... (Enter ส่ง, Shift+Enter ขึ้นบรรทัด)"
                        rows={2}
                        className="resize-none text-sm border-slate-200 flex-1"
                        disabled={loading}
                    />
                    <Button
                        onClick={handleSend}
                        disabled={!input.trim() || loading}
                        size="icon"
                        className="bg-indigo-600 hover:bg-indigo-700 shrink-0 h-[60px] w-10"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                    AI ดึงข้อมูลจากระบบเฉพาะ candidates ใน JR นี้ ({jrId}) • Conversation จะถูกจำไว้ข้ามเซสชัน
                </p>
            </div>
        </div>
    );
}

// ── Main Component ──────────────────────────────
export function AiSuggestionTab({ jrId, jrTitle, jrDescription }: Props) {
    const [activeTab, setActiveTab] = useState<"chat" | "assessment">("chat");
    const [openProfileId, setOpenProfileId] = useState<string | null>(null);
    const [query, setQuery] = useState(jrDescription ?? "");
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
    const [exportLoading, setExportLoading] = useState(false);
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
        setQuery(jrDescription ?? "");
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
    }, [jrId, jrDescription]);

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
        <div className="space-y-3 p-1">
            {/* Inner Tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                <button
                    onClick={() => setActiveTab("chat")}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
                        activeTab === "chat"
                            ? "bg-white text-indigo-700 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Chat
                </button>
                <button
                    onClick={() => setActiveTab("assessment")}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
                        activeTab === "assessment"
                            ? "bg-white text-indigo-700 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                    <Sparkles className="w-3.5 h-3.5" />
                    Assessment
                </button>
            </div>

            {/* Chat Tab */}
            {activeTab === "chat" && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <ChatSection jrId={jrId} jrTitle={jrTitle} />
                </div>
            )}

            {/* Assessment Tab */}
            {activeTab === "assessment" && <div className="space-y-4">
            {/* Query input card */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">AI Criteria (Default is Job Description)</span>
                </div>
                <Textarea
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    rows={6}
                    className="resize-y text-sm border-slate-200"
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
                    {status === "completed" && activeJobId && (
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={exportLoading}
                            title="Export PPTX"
                            onClick={async () => {
                                setExportLoading(true);
                                try {
                                    const { base64, filename } = await generateAssessmentPPTX(activeJobId, jrId, jrTitle ?? jrId);
                                    const link = document.createElement("a");
                                    link.href = `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${base64}`;
                                    link.download = filename;
                                    link.click();
                                } catch (e: any) {
                                    alert(`Export failed: ${e.message}`);
                                } finally {
                                    setExportLoading(false);
                                }
                            }}
                            className="gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                        >
                            {exportLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                            Export PPTX
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

                            {/* Top 3 hero cards */}
                            {status === "completed" && sortedTop20.length >= 3 && (
                                <Top3Section results={sortedTop20} activeCategory={activeCategory} onOpenProfile={setOpenProfileId} />
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
                                    <ResultRow key={r.candidate_id} r={r} activeCategory={activeCategory} displayRank={idx + 1} onOpenProfile={setOpenProfileId} />
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
            </div>}

            {/* Profile Sheet */}
            <CandidateProfileSheet
                candidateId={openProfileId}
                open={!!openProfileId}
                onOpenChange={(v) => { if (!v) setOpenProfileId(null); }}
            />
        </div>
    );
}

