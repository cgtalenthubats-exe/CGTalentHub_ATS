"use client";

import { useState } from "react";
import { History, Pencil, Trash2, Plus, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatDateForDisplay } from "@/lib/date-utils";
import { StatusLog } from "@/types/requisition";
import { addActivityLog, updateActivityLog, deleteActivityLog } from "@/app/actions/jr-candidate-logs";
import { getUserProfiles, UserProfile, getCurrentUserRealName } from "@/app/actions/user-actions";
import { getStatusMaster, StatusMasterRow } from "@/app/actions/status-master";
import { toast } from "@/lib/notifications";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface CandidateActivityLogProps {
    logs: StatusLog[];
    jrCandidateId: string;
    isReadOnly?: boolean;
}

export function CandidateActivityLog({ logs, jrCandidateId, isReadOnly = false }: CandidateActivityLogProps) {
    const router = useRouter();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [editingLog, setEditingLog] = useState<StatusLog | null>(null);
    const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
    const [availableStatuses, setAvailableStatuses] = useState<StatusMasterRow[]>([]);
    const [formData, setFormData] = useState({
        status: "",
        note: "",
        updatedBy: "",
        timestamp: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        async function loadUsers() {
            const res = await getUserProfiles();
            if (res.success && res.data) {
                setUserProfiles(res.data);
            }
            const currentName = await getCurrentUserRealName();
            if (currentName) {
                setFormData(prev => ({ ...prev, updatedBy: currentName }));
            }

            const statuses = await getStatusMaster();
            setAvailableStatuses(statuses);
        }
        loadUsers();
    }, []);

    const handleAdd = () => {
        setEditingLog(null);
        // Reset but keep the last selected or current user if possible
        setFormData(prev => ({
            ...prev,
            status: "Pool Candidate",
            note: "",
            timestamp: new Date().toISOString().split('T')[0]
        }));
        setIsDialogOpen(true);
    };

    const handleEdit = (log: StatusLog) => {
        setEditingLog(log);
        setFormData({
            status: log.status,
            note: log.note || "",
            updatedBy: log.updated_by || "",
            timestamp: log.timestamp
        });
        setIsDialogOpen(true);
    };

    const handleDelete = async (logId: number) => {
        if (!confirm("Are you sure you want to delete this activity log?")) return;

        try {
            const res = await deleteActivityLog(logId);
            if (res.success) {
                toast.success("Activity log deleted");
                router.refresh();
            } else {
                toast.error(res.error || "Failed to delete log");
            }
        } catch (e) {
            toast.error("An error occurred");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            let res;
            if (editingLog) {
                res = await updateActivityLog(editingLog.log_id, formData.status, formData.note, formData.updatedBy, formData.timestamp);
            } else {
                res = await addActivityLog(jrCandidateId, formData.status, formData.note, formData.updatedBy, formData.timestamp);
            }

            if (res.success) {
                toast.success(editingLog ? "Log updated" : "Log added");
                setIsDialogOpen(false);
                router.refresh();
            } else {
                toast.error(res.error || "Operation failed");
            }
        } catch (e) {
            toast.error("An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="rounded-2xl border-none shadow-sm shadow-indigo-100 h-fit sticky top-24">
            <CardHeader className="pb-4 border-b border-slate-50 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <History className="h-4 w-4" /> Activity Log
                </CardTitle>
                {!isReadOnly && (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full"
                        onClick={handleAdd}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                )}
            </CardHeader>
            <CardContent className="pt-6 relative">
                <div className="absolute left-[35px] top-6 bottom-6 w-0.5 bg-slate-100" />
                <div className="space-y-8">
                    {logs.map((log, idx) => (
                        <div key={log.log_id} className="relative flex gap-4 pr-2 group">
                            <div className={cn(
                                "z-10 h-3 w-3 rounded-full shrink-0 mt-1 border-2 border-white ring-2 ring-slate-50",
                                idx === 0 ? "bg-indigo-500 ring-indigo-50 scale-125" : "bg-slate-300"
                            )} />
                            <div className="flex flex-col gap-1 flex-1">
                                <div className="flex justify-between items-start">
                                    <span className={cn(
                                        "text-sm font-black leading-none",
                                        idx === 0 ? "text-indigo-700" : "text-slate-800"
                                    )}>
                                        {log.status}
                                    </span>
                                    {!isReadOnly && (
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => handleEdit(log)}
                                                className="text-slate-400 hover:text-indigo-600"
                                            >
                                                <Pencil className="h-3 w-3" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(log.log_id)}
                                                className="text-slate-400 hover:text-red-600"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-[12px] text-slate-400 font-bold">
                                    <span>{formatDateForDisplay(log.timestamp)}</span>
                                    <span>•</span>
                                    <span className="text-slate-500">{log.updated_by}</span>
                                </div>
                                {log.note && (
                                    <p className="text-[14px] text-slate-900 bg-slate-50 rounded-lg p-2.5 mt-1 font-semibold border border-slate-100">
                                        {log.note}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-slate-900">
                            {editingLog ? "Edit Activity Log" : "Add Activity Log"}
                        </DialogTitle>
                        <DialogDescription>
                            {editingLog ? "Update the existing activity entry." : "Create a new entry in the candidate's activity history."}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="status" className="text-xs font-black uppercase text-slate-500">Status</Label>
                            <Select
                                value={formData.status}
                                onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableStatuses.map((s) => (
                                        <SelectItem key={s.status} value={s.status}>
                                            {s.status}
                                        </SelectItem>
                                    ))}
                                    {/* Fallback if no statuses loaded yet */}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="timestamp" className="text-xs font-black uppercase text-slate-500">Event Date (Backdating)</Label>
                            <div className="flex flex-col gap-1">
                                <Input
                                    id="timestamp"
                                    type="date"
                                    value={formData.timestamp}
                                    onChange={(e) => setFormData(prev => ({ ...prev, timestamp: e.target.value }))}
                                />
                                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest pl-1">
                                    Format: {formatDateForDisplay(formData.timestamp)}
                                </span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="updatedBy" className="text-xs font-black uppercase text-slate-500">Updated By</Label>
                            <Select
                                value={formData.updatedBy}
                                onValueChange={(v) => setFormData(prev => ({ ...prev, updatedBy: v }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Recruiter / Admin" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="System">System</SelectItem>
                                    {userProfiles.map((user, idx) => (
                                        <SelectItem key={`${user.email}-${idx}`} value={user.real_name}>
                                            {user.real_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="note" className="text-xs font-black uppercase text-slate-500">Note</Label>
                            <Textarea
                                id="note"
                                value={formData.note}
                                onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                                placeholder="Add some details about this status change..."
                                className="min-h-[100px] resize-none"
                            />
                        </div>
                        <DialogFooter className="pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsDialogOpen(false)}
                                className="font-bold"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold min-w-[100px]"
                            >
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingLog ? "Update" : "Add")}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
