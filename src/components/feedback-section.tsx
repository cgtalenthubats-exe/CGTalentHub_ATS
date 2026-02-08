
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Star, FileText, Plus, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddFeedbackDialog } from "@/components/add-feedback-dialog";

interface FeedbackSectionProps {
    jrCandidateId: string;
    candidateName: string;
    feedback: any[];
}

export function FeedbackSection({ jrCandidateId, candidateName, feedback }: FeedbackSectionProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedFeedback, setSelectedFeedback] = useState<any | null>(null);

    const handleAdd = () => {
        setSelectedFeedback(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (item: any) => {
        setSelectedFeedback(item);
        setIsDialogOpen(true);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 pl-1">
                    <Star className="h-4 w-4" /> Interview Feedback
                </h2>
                <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-2 bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50 hover:text-indigo-700 font-bold"
                    onClick={handleAdd}
                >
                    <Plus className="h-3 w-3" /> Add Feedback
                </Button>
            </div>

            {feedback.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 border border-dashed border-slate-200 text-center">
                    <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MessageSquare className="h-6 w-6 text-slate-300" />
                    </div>
                    <p className="text-sm text-slate-400 font-bold">No interview feedback submitted yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {feedback.map((f: any) => (
                        <Card key={f.feedback_id} className="rounded-2xl border-none shadow-sm shadow-indigo-100 hover:shadow-md transition-shadow group relative">
                            {/* Edit Button */}
                            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full"
                                    onClick={() => handleEdit(f)}
                                >
                                    <Pencil className="h-3 w-3" />
                                </Button>
                            </div>

                            <CardHeader className="pb-3 border-b border-slate-50">
                                <div className="flex justify-between items-start pr-8">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">
                                            {f.Interviewer_type || "Interview"}
                                        </span>
                                        <span className="font-black text-slate-900 leading-tight">{f.Interviewer_name}</span>
                                    </div>
                                    <div className="bg-indigo-50 text-indigo-700 rounded-lg px-2 py-1 flex items-center gap-1">
                                        <Star className="h-3 w-3 fill-current" />
                                        <span className="text-xs font-black">{f.rating_score || "-"}</span>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-3">
                                <p className="text-[13px] text-slate-600 font-medium leading-relaxed italic line-clamp-4">
                                    &quot;{f.feedback_text}&quot;
                                </p>
                                {f.feedback_file && (
                                    <a
                                        href={f.feedback_file}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline bg-indigo-50 w-fit px-2 py-1 rounded-md transition-colors"
                                    >
                                        <FileText className="h-3 w-3" /> View Attachment
                                    </a>
                                )}
                                <div className="flex justify-between items-center pt-2">
                                    <span className="text-[10px] font-bold text-slate-400">{f.interview_date}</span>
                                    <Badge variant="outline" className={cn(
                                        "text-[9px] font-black uppercase tracking-widest",
                                        ['Strong Recommend', 'Hire', 'Recommend', 'Strongly Recommend'].includes(f.overall_recommendation)
                                            ? 'bg-green-50 text-green-700 border-green-100'
                                            : f.overall_recommendation === 'Hold'
                                                ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
                                                : 'bg-red-50 text-red-700 border-red-100'
                                    )}>
                                        {f.overall_recommendation}
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <AddFeedbackDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                jrCandidateId={jrCandidateId}
                candidateName={candidateName}
                initialData={selectedFeedback}
            />
        </div>
    );
}
