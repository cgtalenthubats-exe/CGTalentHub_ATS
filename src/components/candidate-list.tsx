"use client";

import { useEffect, useState } from "react";
import { JRCandidate } from "@/types/requisition";
import { getJRCandidates } from "@/app/actions/jr-candidates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MoreHorizontal, MessageSquare, ArrowRight, UserMinus } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CandidateListProps {
    jrId: string;
}

export function CandidateList({ jrId }: CandidateListProps) {
    const [candidates, setCandidates] = useState<JRCandidate[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterText, setFilterText] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("All");

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const data = await getJRCandidates(jrId);
                setCandidates(data);
            } catch (error) {
                console.error("Failed to load candidates", error);
            }
            setLoading(false);
        }
        if (jrId) load();
    }, [jrId]);

    // Status Definitions
    const greyStatuses = ["Not fit", "Not Open", "Not Pass Interview", "Too Senior"];
    const redStatuses = ["Rejected"];

    // Default Filters
    const filteredCandidates = candidates.filter(c => {
        const matchesText =
            (c.candidate_name || "").toLowerCase().includes(filterText.toLowerCase()) ||
            (c.candidate_id || "").toLowerCase().includes(filterText.toLowerCase()) ||
            (c.candidate_current_position || "").toLowerCase().includes(filterText.toLowerCase());

        const matchesStatus = statusFilter === "All" || c.status === statusFilter;

        return matchesText && matchesStatus;
    });

    // Custom Sorting: Active > Grey > Red
    const sortedCandidates = [...filteredCandidates].sort((a, b) => {
        const getScore = (s: string) => {
            if (redStatuses.includes(s)) return 3;
            if (greyStatuses.includes(s)) return 2;
            return 1;
        };

        const scoreA = getScore(a.status);
        const scoreB = getScore(b.status);

        if (scoreA !== scoreB) return scoreA - scoreB;

        // Secondary Sort: Rank (Asc) or Name
        return (parseInt(a.rank || "999") - parseInt(b.rank || "999"));
    });

    // Row Style Helper
    const getRowClass = (status: string) => {
        if (redStatuses.includes(status)) return "bg-red-50 hover:bg-red-100/50 dark:bg-red-950/20 dark:hover:bg-red-900/30 border-b";
        if (greyStatuses.includes(status)) return "bg-slate-100 hover:bg-slate-200/50 dark:bg-slate-800/40 dark:hover:bg-slate-800/60 border-b";
        return "border-b last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors";
    };

    const uniqueStatuses = Array.from(new Set(candidates.map(c => c.status)));

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading candidates...</div>;
    // Keep showing table even if filtered empty, so user can clear filter

    return (
        <Card>
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-semibold">Active Candidates ({filteredCandidates.length})</CardTitle>
                <div className="flex gap-2">
                    <input
                        className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        placeholder="Search name, id, pos..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                    />
                    <select
                        className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="All">All Statuses</option>
                        {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/50 border-b">
                            <th className="text-left font-medium text-muted-foreground px-4 py-3 w-[60px]">Rank</th>
                            <th className="text-left font-medium text-muted-foreground px-4 py-3 w-[100px]">List Type</th>
                            <th className="text-left font-medium text-muted-foreground px-4 py-3 w-[120px]">Status</th>
                            <th className="text-left font-medium text-muted-foreground px-4 py-3 w-[60px]">Profile</th>
                            <th className="text-left font-medium text-muted-foreground px-4 py-3 w-[100px]">ID</th>
                            <th className="text-left font-medium text-muted-foreground px-4 py-3 w-[200px]">Name</th>
                            <th className="text-left font-medium text-muted-foreground px-4 py-3 w-[80px]">Gender</th>
                            <th className="text-left font-medium text-muted-foreground px-4 py-3 w-[60px]">Age</th>
                            <th className="text-left font-medium text-muted-foreground px-4 py-3 w-[200px]">Current Position</th>
                            <th className="text-left font-medium text-muted-foreground px-4 py-3 w-[200px]">Current Company</th>
                            <th className="text-right font-medium text-muted-foreground px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedCandidates.map((c) => (
                            <tr key={c.id} className={getRowClass(c.status)}>
                                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.rank || "-"}</td>
                                <td className="px-4 py-3">
                                    <Badge variant="outline" className="font-normal text-xs bg-white dark:bg-slate-950 text-nowrap">
                                        {c.list_type || "N/A"}
                                    </Badge>
                                </td>
                                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                                <td className="px-4 py-3">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={c.candidate_image_url} />
                                        <AvatarFallback>{c.candidate_name?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-primary underline cursor-pointer">{c.candidate_id}</td>
                                <td className="px-4 py-3 font-medium text-sm text-foreground">{c.candidate_name}</td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">{c.candidate_gender || "-"}</td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">{c.candidate_age || "-"}</td>
                                <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[200px]" title={c.candidate_current_position}>
                                    {c.candidate_current_position || "-"}
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[200px]" title={c.candidate_current_company}>
                                    {c.candidate_current_company || "-"}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <DropdownMenuItem>
                                                <MessageSquare className="mr-2 h-4 w-4" /> Add Feedback
                                            </DropdownMenuItem>
                                            <DropdownMenuItem>
                                                <ArrowRight className="mr-2 h-4 w-4" /> Move Stage
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-red-600">
                                                <UserMinus className="mr-2 h-4 w-4" /> Remove
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </CardContent>
        </Card>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        'Pool': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
        'Phone Screen': 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300',
        'Interview': 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300',
        'Offer': 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300',
        'Hired': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
        'Rejected': 'bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400',
        'Pool Candidate': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    };
    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status] || 'bg-gray-100'}`}>
            {status}
        </span>
    );
}
