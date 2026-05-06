"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, Loader2, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { triggerStage3Ranking, getStage3JobStatus, type Stage3JobData, type Stage3Result } from "@/app/actions/ai-ranking";

interface Props {
    jrId: string;
    jrTitle?: string;
}

function ScoreBar({ score }: { score: number }) {
    const color = score >= 75 ? "bg-emerald-500" : score >= 55 ? "bg-amber-400" : "bg-rose-400";
    const textColor = score >= 75 ? "text-emerald-600" : score >= 55 ? "text-amber-600" : "text-rose-500";
    return (
        <div className="flex items-center gap-2 shrink-0">
            <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${score}%` }} />
            </div>
            <span className={`text-sm font-bold tabular-nums w-6 text-right ${textColor}`}>{score}</span>
        </div>
    );
}

function RankBadge({ rank }: { rank: number }) {
    const gold = rank === 1 ? "bg-amber-400 text-white" : rank <= 3 ? "bg-slate-300 text-slate-700" : "bg-slate-100 text-slate-500";
    return (
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${gold}`}>
            {rank}
        </div>
    );
}

function ResultRow({ r }: { r: Stage3Result }) {
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

export function AiSuggestionTab({ jrId, jrTitle }: Props) {
    const [query, setQuery] = useState(jrTitle ?? "");
    const [status, setStatus] = useState<"idle" | "processing" | "completed" | "error">("idle");
    const [pollingStatus, setPollingStatus] = useState<string | null>(null);
    const [data, setData] = useState<Stage3JobData | null>(null);
    const [candidateCount, setCandidateCount] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const jobIdRef = useRef<string | null>(null);

    const stopPolling = () => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };

    useEffect(() => () => stopPolling(), []);

    // Reset when JR changes
    useEffect(() => {
        stopPolling();
        setStatus("idle");
        setData(null);
        setQuery(jrTitle ?? "");
        setErrorMsg(null);
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
                    // Show partial results as they arrive
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
        try {
            const { jobId, candidateCount: cnt } = await triggerStage3Ranking(jrId, query.trim());
            setCandidateCount(cnt);
            startPolling(jobId);
        } catch (err: any) {
            setStatus("error");
            setErrorMsg(err.message ?? "เกิดข้อผิดพลาด");
        } finally {
            setLoading(false);
        }
    };

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
                    {status !== "idle" && (
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => { stopPolling(); setStatus("idle"); setData(null); }}
                            title="Reset"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Processing */}
            {status === "processing" && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-8 text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-400" />
                    <p className="text-sm font-medium text-indigo-700">
                        {pollingStatus === "ready_to_analyse" && "รอ AI เริ่มประเมิน..."}
                        {pollingStatus === "analysing" && `AI กำลังประเมิน ${candidateCount ? `${candidateCount} candidates` : "candidates"}...`}
                        {pollingStatus === "pending_summary" && "AI กำลังสรุปผลและจัดอันดับ..."}
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

            {/* Results — show progressively while processing or after completed */}
            {data && data.results.length > 0 && (
                <div className="space-y-3">
                    {/* Summary banner — only when completed */}
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

                    {/* Header */}
                    <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            {status === "processing"
                                ? <>Evaluating... <span className="text-indigo-500">{data.results.length} done so far</span></>
                                : <>Ranked {data.results.length} candidates</>
                            }
                        </span>
                        <span className="text-xs text-slate-400">คลิกแถวเพื่อดูรายละเอียด</span>
                    </div>

                    {/* Ranked list */}
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                        {data.results.map(r => <ResultRow key={r.candidate_id} r={r} />)}
                    </div>
                </div>
            )}
        </div>
    );
}
