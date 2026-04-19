"use client";


import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader2, Upload } from "lucide-react";
import { submitInterviewFeedback } from "@/app/actions/interview-feedback";
import { toast } from "@/lib/notifications";
import { supabase } from "@/lib/supabase/client";
import { formatDateForDisplay } from "@/lib/date-utils";

interface AddFeedbackDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    jrCandidateId: string;
    candidateName: string;
    onSuccess?: () => void;
    initialData?: {
        feedback_id: number;
        interview_date: string;
        Interviewer_type: string;
        Interviewer_name: string;
        rating_score: number;
        overall_recommendation: string;
        feedback_text: string;
        feedback_file: string | null;
    } | null;
}

export function AddFeedbackDialog({
    open,
    onOpenChange,
    jrCandidateId,
    candidateName,
    onSuccess,
    initialData,
}: AddFeedbackDialogProps) {
    const [loading, setLoading] = useState(false);
    const [fileStats, setFileStats] = useState<{ name: string; size: number } | null>(null);

    // Form State
    const [interviewDate, setInterviewDate] = useState("");
    const [interviewerName, setInterviewerName] = useState("");
    const [interviewType, setInterviewType] = useState("");
    const [rating, setRating] = useState(5);
    const [recommendation, setRecommendation] = useState("");
    const [feedbackText, setFeedbackText] = useState("");
    const [file, setFile] = useState<File | null>(null);

    useEffect(() => {
        if (open) {
            if (initialData) {
                setInterviewDate(initialData.interview_date || "");
                setInterviewerName(initialData.Interviewer_name || "");
                setInterviewType(initialData.Interviewer_type || "");
                setRating(initialData.rating_score || 5);
                setRecommendation(initialData.overall_recommendation || "");
                setFeedbackText(initialData.feedback_text || "");
                // File handling is tricky for edit, usually we just show existing and allow new upload
            } else {
                resetForm();
            }
        }
    }, [open, initialData]);

    const resetForm = () => {
        setInterviewDate("");
        setInterviewerName("");
        setInterviewType("");
        setRating(5);
        setRecommendation("");
        setFeedbackText("");
        setFile(null);
        setFileStats(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setFileStats({
                name: e.target.files[0].name,
                size: e.target.files[0].size
            });
        }
    };

    const handleSubmit = async () => {
        if (!interviewDate || !interviewerName || !interviewType || !recommendation) {
            toast.error("Please fill in all required fields.");
            return;
        }

        setLoading(true);
        try {
            let fileUrl = "";

            // 1. Upload File if exists
            if (file) {
                const fileExt = file.name.split('.').pop() || 'bin';
                const fileName = `${jrCandidateId}_${Date.now()}.${fileExt}`;
                const filePath = `feedback-attachments/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('resumes') // Using existing bucket or new one? User didn't specify.
                    // Let's assume 'resumes' bucket is safe for now or 'documents' if exists.
                    // Given previous context, 'resumes' is the main one.
                    .upload(filePath, file);

                if (uploadError) {
                    throw new Error("File upload failed: " + uploadError.message);
                }

                // Get Public URL
                const { data: publicUrlData } = supabase.storage
                    .from('resumes')
                    .getPublicUrl(filePath);

                fileUrl = publicUrlData.publicUrl;
            }

            // 2. Submit Data
            const res = await submitInterviewFeedback({
                feedback_id: initialData?.feedback_id,
                jr_candidate_id: jrCandidateId,
                interview_date: interviewDate,
                interviewer_name: interviewerName,
                interview_type: interviewType,
                rating: rating,
                recommendation: recommendation,
                feedback_text: feedbackText,
                feedback_file_url: fileUrl || initialData?.feedback_file || undefined,
                candidate_name: candidateName,
            });

            if (res.success) {
                toast.success("Feedback submitted successfully!");
                resetForm();
                onOpenChange(false);
                if (onSuccess) onSuccess();
            } else {
                toast.error("Error: " + res.error);
            }

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to submit feedback");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Edit Interview Feedback" : "Add Interview Feedback"}</DialogTitle>
                    <DialogDescription>
                        {initialData ? "Update" : "Record"} interview details for <span className="font-bold text-slate-800">{candidateName}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="date" className="text-xs font-bold uppercase text-slate-500">Interview Date <span className="text-red-500">*</span></Label>
                            <div className="flex flex-col gap-1">
                                <Input
                                    id="date"
                                    type="date"
                                    value={interviewDate}
                                    onChange={(e) => setInterviewDate(e.target.value)}
                                />
                                {interviewDate && (
                                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest pl-1">
                                        Preview: {formatDateForDisplay(interviewDate)}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="type" className="text-xs font-bold uppercase text-slate-500">Interview Type <span className="text-red-500">*</span></Label>
                            <Select value={interviewType} onValueChange={setInterviewType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Recruiter">Recruiter Screen</SelectItem>
                                    <SelectItem value="Hiring Manager">Hiring Manager</SelectItem>
                                    <SelectItem value="BU CPO">BU CPO</SelectItem>
                                    <SelectItem value="CG CPO">CG CPO</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="interviewer" className="text-xs font-bold uppercase text-slate-500">Interviewer Name <span className="text-red-500">*</span></Label>
                        <Input
                            id="interviewer"
                            placeholder="Ex: John Doe"
                            value={interviewerName}
                            onChange={(e) => setInterviewerName(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-bold uppercase text-slate-500">Rating (1-10)</Label>
                            <div className="flex items-center gap-4 pt-2">
                                <Slider
                                    value={[rating]}
                                    onValueChange={(vals: number[]) => setRating(vals[0])}
                                    min={1}
                                    max={10}
                                    step={1}
                                    className="flex-1"
                                />
                                <span className="font-black text-lg w-8 text-center">{rating}</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="rec" className="text-xs font-bold uppercase text-slate-500">Recommendation <span className="text-red-500">*</span></Label>
                            <Select value={recommendation} onValueChange={setRecommendation}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select result" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Strong Recommend">Strong Recommend</SelectItem>
                                    <SelectItem value="Hire">Hire</SelectItem>
                                    <SelectItem value="Hold">Hold</SelectItem>
                                    <SelectItem value="Reject">Reject</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="feedback" className="text-xs font-bold uppercase text-slate-500">Feedback / Comments</Label>
                        <Textarea
                            id="feedback"
                            placeholder="Enter detailed feedback here..."
                            className="h-32 resize-none"
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-bold uppercase text-slate-500">Attachment (Optional)</Label>
                        <div className="border border-dashed border-slate-300 rounded-lg p-4 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative">
                            <input
                                type="file"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={handleFileChange}
                                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                            />
                            <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                                <Upload className="h-6 w-6" />
                                {fileStats ? (
                                    <div className="text-center">
                                        <p className="text-sm font-semibold text-indigo-600">{fileStats.name}</p>
                                        <p className="text-xs text-slate-400">{(fileStats.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                ) : (
                                    <p className="text-sm font-medium">Click to upload evaluation form or notes</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Submit Feedback
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
