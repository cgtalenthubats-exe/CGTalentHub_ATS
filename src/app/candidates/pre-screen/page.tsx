"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { AtsBreadcrumb } from "@/components/ats-breadcrumb";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, FileText, ExternalLink, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type PreScreenLog = {
    pre_screen_id: number;
    candidate_id: string;
    name: string;
    screening_date: string;
    screener_Name: string;
    overall_impression: string;
    rating_score: number;
    feedback_text: string;
    feedback_file: string;
};

export default function PreScreenTablePage() {
    const [logs, setLogs] = useState<PreScreenLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedLog, setSelectedLog] = useState<PreScreenLog | null>(null);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('pre_screen_log')
                .select('*')
                .order('pre_screen_id', { ascending: false });

            if (error) throw error;
            setLogs(data || []);
        } catch (error) {
            console.error("Error fetching pre-screen logs:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const filteredLogs = logs.filter(log => 
        (log.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.candidate_id?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.screener_Name?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const getImpressionColor = (impression: string) => {
        switch (impression?.toLowerCase()) {
            case 'positive': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'negative': return 'bg-red-100 text-red-800 border-red-200';
            case 'neutral': return 'bg-amber-100 text-amber-800 border-amber-200';
            default: return 'bg-slate-100 text-slate-800 border-slate-200';
        }
    };

    return (
        <div className="flex flex-col gap-6 max-w-7xl mx-auto p-4 md:p-8">
            <AtsBreadcrumb
                items={[
                    { label: 'Candidates', href: '/candidates' },
                    { label: 'Pre-Screen Logs' }
                ]}
            />

            <div className="flex justify-between items-end">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-extrabold tracking-tight">Pre-Screen Logs</h1>
                    <p className="text-muted-foreground">Review initial screening results and feedback.</p>
                </div>
            </div>

            <Card className="border-none shadow-xl bg-white/50 backdrop-blur-sm">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100/50 pb-4">
                    <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
                        <div className="relative w-full sm:w-96">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search by name, ID, or screener..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 h-10 bg-white border-slate-200 rounded-xl"
                            />
                        </div>
                        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading} className="gap-2">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="h-[400px] flex flex-col items-center justify-center gap-4 text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <span className="text-xs font-bold uppercase tracking-widest">Loading Logs...</span>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="h-[200px] flex flex-col items-center justify-center gap-2 text-slate-400">
                            <Search className="w-8 h-8 opacity-20" />
                            <span className="text-xs">No matching records found</span>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-slate-50 sticky top-0">
                                <TableRow>
                                    <TableHead>Candidate</TableHead>
                                    <TableHead>Screener</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Impression</TableHead>
                                    <TableHead>Score</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredLogs.map((log) => (
                                    <TableRow key={log.pre_screen_id} className="hover:bg-slate-50">
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-900">{log.name || 'Unknown'}</span>
                                                <span className="text-xs text-slate-500">{log.candidate_id}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm text-slate-600">{log.screener_Name || 'N/A'}</span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm text-slate-600">{log.screening_date || 'N/A'}</span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`${getImpressionColor(log.overall_impression)} font-bold`}>
                                                {log.overall_impression || 'N/A'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <span className="font-bold text-slate-700">{log.rating_score || 0}</span>
                                                <span className="text-xs text-slate-400">/ 10</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                                onClick={() => setSelectedLog(log)}
                                            >
                                                <FileText className="w-4 h-4 mr-2" /> View Details
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl flex items-center gap-2">
                            <FileText className="w-5 h-5 text-indigo-500" />
                            Pre-Screen Feedback
                        </DialogTitle>
                        <DialogDescription>
                            Details for {selectedLog?.name} ({selectedLog?.candidate_id})
                        </DialogDescription>
                    </DialogHeader>

                    {selectedLog && (
                        <div className="flex flex-col gap-6 mt-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs font-semibold text-slate-500 uppercase">Screener</span>
                                    <span className="text-sm font-medium">{selectedLog.screener_Name || '-'}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs font-semibold text-slate-500 uppercase">Date</span>
                                    <span className="text-sm font-medium">{selectedLog.screening_date || '-'}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs font-semibold text-slate-500 uppercase">Impression</span>
                                    <div>
                                        <Badge variant="outline" className={`${getImpressionColor(selectedLog.overall_impression)}`}>
                                            {selectedLog.overall_impression || '-'}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs font-semibold text-slate-500 uppercase">Score</span>
                                    <span className="text-sm font-bold text-slate-700">{selectedLog.rating_score || 0}/10</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <span className="text-sm font-bold text-slate-900 border-b pb-2">Feedback Summary</span>
                                <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                                    {selectedLog.feedback_text || 'No feedback provided.'}
                                </div>
                            </div>

                            {selectedLog.feedback_file && (
                                <div className="flex flex-col gap-2 pt-4 border-t border-slate-100">
                                    <span className="text-sm font-bold text-slate-900">Attachment</span>
                                    <Button variant="outline" className="w-fit" asChild>
                                        <a href={selectedLog.feedback_file} target="_blank" rel="noreferrer">
                                            <ExternalLink className="w-4 h-4 mr-2" /> Open Feedback File
                                        </a>
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
