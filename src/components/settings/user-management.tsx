"use client";

import React, { useEffect, useState } from "react";
import { UserProfile, getUserProfiles, upsertUserProfile, deleteUserProfile } from "@/app/actions/user-actions";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import { Users, Plus, Pencil, Trash2, Loader2, Save, X } from "lucide-react";
import { toast } from "@/lib/notifications";
import { Badge } from "@/components/ui/badge";

export function UserManagement() {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

    const [formData, setFormData] = useState({
        email: "",
        real_name: "",
        role: "user"
    });

    const loadUsers = async () => {
        setLoading(true);
        const res = await getUserProfiles();
        if (res.success && res.data) {
            setUsers(res.data);
        } else {
            toast.error("Failed to load users");
        }
        setLoading(false);
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const handleOpenDialog = (user?: UserProfile) => {
        if (user) {
            setEditingUser(user);
            setFormData({
                email: user.email,
                real_name: user.real_name,
                role: user.role
            });
        } else {
            setEditingUser(null);
            setFormData({
                email: "",
                real_name: "",
                role: "user"
            });
        }
        setIsDialogOpen(true);
    };

    const handleSubmit = async () => {
        if (!formData.email || !formData.real_name) {
            toast.error("Please fill in all fields");
            return;
        }

        setIsSubmitting(true);
        const res = await upsertUserProfile({
            email: formData.email,
            real_name: formData.real_name,
            role: formData.role
        });

        if (res.success) {
            toast.success(editingUser ? "User updated" : "User added");
            setIsDialogOpen(false);
            loadUsers();
        } else {
            toast.error("Failed to save user: " + res.error);
        }
        setIsSubmitting(false);
    };

    const handleDelete = async (email: string) => {
        if (!confirm("Are you sure you want to delete this user?")) return;

        const res = await deleteUserProfile(email);
        if (res.success) {
            toast.success("User deleted");
            loadUsers();
        } else {
            toast.error("Failed to delete user: " + res.error);
        }
    };

    return (
        <Card className="border-none shadow-sm bg-white">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <Users className="w-5 h-5 text-indigo-500" />
                            User Profiles
                        </CardTitle>
                        <CardDescription>
                            Map email addresses to real names for display throughout the system.
                        </CardDescription>
                    </div>
                    <Button onClick={() => handleOpenDialog()} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider">
                        <Plus className="w-4 h-4 mr-2" /> Add User
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-xl border border-slate-100 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="font-bold text-xs uppercase tracking-widest text-slate-500">Real Name</TableHead>
                                <TableHead className="font-bold text-xs uppercase tracking-widest text-slate-500">Email</TableHead>
                                <TableHead className="font-bold text-xs uppercase tracking-widest text-slate-500">Role</TableHead>
                                <TableHead className="text-right font-bold text-xs uppercase tracking-widest text-slate-500">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-48 text-center">
                                        <div className="flex flex-col items-center gap-2 text-slate-400">
                                            <Loader2 className="w-6 h-6 animate-spin" />
                                            <span className="text-xs font-bold uppercase tracking-widest">Loading users...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-48 text-center text-slate-400 font-bold uppercase tracking-widest">
                                        No users found. Add one to get started.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map((user) => (
                                    <TableRow key={user.email} className="group hover:bg-slate-50/50">
                                        <TableCell className="font-bold text-slate-800">{user.real_name}</TableCell>
                                        <TableCell className="font-mono text-xs text-slate-600">{user.email}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-[10px] bg-slate-50 uppercase tracking-wider font-bold text-slate-500 border-slate-200">
                                                {user.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(user)} className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50">
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(user.email)} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px] rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
                    <DialogHeader className="p-6 bg-slate-900 text-white">
                        <DialogTitle className="text-xl font-black flex items-center gap-2">
                            {editingUser ? <Pencil className="w-5 h-5 text-indigo-400" /> : <Plus className="w-5 h-5 text-indigo-400" />}
                            {editingUser ? "Edit User" : "Add New User"}
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                            {editingUser ? "Update user profile details." : "Add a new user mapping to the system."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-6 grid gap-6">
                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Email Address</Label>
                            <Input
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="e.g. user@company.com"
                                disabled={!!editingUser} // Disable email edit for ID stability or simple logic
                                className="h-11 rounded-xl bg-slate-50 border-slate-200 font-mono text-sm"
                            />
                            {editingUser && <p className="text-[10px] text-amber-600 font-bold">* Email cannot be changed (Primary Key)</p>}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Real Name</Label>
                            <Input
                                value={formData.real_name}
                                onChange={(e) => setFormData({ ...formData, real_name: e.target.value })}
                                placeholder="e.g. John Doe"
                                className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Role</Label>
                            <div className="flex gap-2">
                                {['user', 'admin'].map((role, idx) => (
                                    <button
                                        key={`${role}-${idx}`}
                                        onClick={() => setFormData({ ...formData, role })}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest border transition-all ${formData.role === role
                                                ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20'
                                                : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                                            }`}
                                    >
                                        {role}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button
                                variant="ghost"
                                onClick={() => setIsDialogOpen(false)}
                                className="flex-1 rounded-xl font-bold uppercase text-xs tracking-widest h-12"
                            >
                                <X className="w-4 h-4 mr-2" /> Cancel
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold uppercase text-xs tracking-widest h-12 shadow-xl shadow-indigo-500/20"
                            >
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                {editingUser ? "Save Changes" : "Create User"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
