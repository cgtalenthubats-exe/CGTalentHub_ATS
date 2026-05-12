"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateForDisplay } from "@/lib/date-utils";
import { getUserProfiles, UserProfile, getCurrentUserRealName } from "@/app/actions/user-actions";
import { getStatusMaster, StatusMasterRow } from "@/app/actions/status-master";

interface StatusChangeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    targetStatus: string;
    onConfirm: (status: string, note: string, updatedBy: string, timestamp: string) => Promise<void>;
}

export function StatusChangeDialog({ open, onOpenChange, targetStatus, onConfirm }: StatusChangeDialogProps) {
    const [loading, setLoading] = useState(false);
    const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
    const [availableStatuses, setAvailableStatuses] = useState<StatusMasterRow[]>([]);
    
    const [formData, setFormData] = useState({
        status: targetStatus,
        note: "",
        updatedBy: "",
        timestamp: new Date().toISOString().split('T')[0]
    });

    // Update status in form if targetStatus prop changes
    useEffect(() => {
        if (open) {
            setFormData(prev => ({
                ...prev,
                status: targetStatus,
                note: "",
                timestamp: new Date().toISOString().split('T')[0]
            }));
        }
    }, [targetStatus, open]);

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
        if (open) {
            loadUsers();
        }
    }, [open]);

    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        await onConfirm(formData.status, formData.note, formData.updatedBy, formData.timestamp);
        setLoading(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black text-slate-900">
                        Update Status
                    </DialogTitle>
                    <DialogDescription>
                        Confirm the status change and add an optional activity log note.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleConfirm} className="space-y-4 py-4">
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
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                            className="font-bold"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold min-w-[100px]"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Status"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
