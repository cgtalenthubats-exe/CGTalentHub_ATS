"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getRecruiterKPIDetails, KPIDetailResult } from "@/app/actions/kpi-details-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

function KPIDetailContent() {
    const searchParams = useSearchParams();
    const recruiter = searchParams.get('recruiter') || '';
    
    const [details, setDetails] = useState<KPIDetailResult | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (recruiter) {
            getRecruiterKPIDetails(recruiter).then(data => {
                setDetails(data);
                setLoading(false);
            });
        }
    }, [recruiter]);

    if (!recruiter) {
        return <div className="p-8">No recruiter selected.</div>;
    }

    const formatDate = (dateString: string) => {
        if (!dateString) return "-";
        try {
            return format(new Date(dateString), "dd MMM yyyy");
        } catch {
            return dateString;
        }
    };

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/kpi-demo">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                        {recruiter}'s KPI Details
                    </h1>
                    <p className="text-gray-500 mt-1">Detailed breakdown of performance metrics</p>
                </div>
            </div>

            {loading || !details ? (
                <div className="flex h-64 items-center justify-center text-gray-500">Loading details...</div>
            ) : (
                <Tabs defaultValue="sourcing" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 mb-8">
                        <TabsTrigger value="sourcing">Profiles Sourced ({details.sourcing.length})</TabsTrigger>
                        <TabsTrigger value="prescreens">Pre-Screens ({details.prescreens.length})</TabsTrigger>
                        <TabsTrigger value="interviews">Interviews ({details.interviews.length})</TabsTrigger>
                        <TabsTrigger value="jrs">JRs Owned ({details.jrs.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="sourcing">
                        <Card>
                            <CardHeader>
                                <CardTitle>Profiles Sourced</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-gray-50">
                                                <TableHead>Candidate Name</TableHead>
                                                <TableHead>Current Position</TableHead>
                                                <TableHead>Created Date</TableHead>
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {details.sourcing.length === 0 ? (
                                                <TableRow><TableCell colSpan={4} className="text-center py-8 text-gray-500">No candidates sourced</TableCell></TableRow>
                                            ) : (
                                                details.sourcing.map((item, idx) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="font-medium">{item.first_name} {item.last_name}</TableCell>
                                                        <TableCell>{item.position}</TableCell>
                                                        <TableCell>{formatDate(item.created_date)}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="sm" asChild>
                                                                <Link href={`/candidates/${item.candidate_id}`} target="_blank">
                                                                    View <ExternalLink className="ml-2 h-4 w-4" />
                                                                </Link>
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="prescreens">
                        <Card>
                            <CardHeader>
                                <CardTitle>Pre-Screens Conducted</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-gray-50">
                                                <TableHead>Candidate Name</TableHead>
                                                <TableHead>Screening Date</TableHead>
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {details.prescreens.length === 0 ? (
                                                <TableRow><TableCell colSpan={3} className="text-center py-8 text-gray-500">No pre-screens found</TableCell></TableRow>
                                            ) : (
                                                details.prescreens.map((item, idx) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="font-medium">{item.first_name} {item.last_name}</TableCell>
                                                        <TableCell>{formatDate(item.screening_date)}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="sm" asChild>
                                                                <Link href={`/candidates/${item.candidate_id}`} target="_blank">
                                                                    View <ExternalLink className="ml-2 h-4 w-4" />
                                                                </Link>
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="interviews">
                        <Card>
                            <CardHeader>
                                <CardTitle>Interviews Conducted (As Recruiter)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-gray-50">
                                                <TableHead>Candidate Name</TableHead>
                                                <TableHead>Job Requisition</TableHead>
                                                <TableHead>Interview Date</TableHead>
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {details.interviews.length === 0 ? (
                                                <TableRow><TableCell colSpan={4} className="text-center py-8 text-gray-500">No interviews found</TableCell></TableRow>
                                            ) : (
                                                details.interviews.map((item, idx) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="font-medium">{item.candidate_first_name} {item.candidate_last_name}</TableCell>
                                                        <TableCell>{item.jr_title}</TableCell>
                                                        <TableCell>{formatDate(item.interview_date)}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="sm" asChild>
                                                                <Link href={`/requisitions/manage/candidate/${item.jr_candidate_id}`} target="_blank">
                                                                    View <ExternalLink className="ml-2 h-4 w-4" />
                                                                </Link>
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="jrs">
                        <Card>
                            <CardHeader>
                                <CardTitle>Job Requisitions Owned</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-gray-50">
                                                <TableHead>JR Title</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Created Date</TableHead>
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {details.jrs.length === 0 ? (
                                                <TableRow><TableCell colSpan={4} className="text-center py-8 text-gray-500">No JRs found</TableCell></TableRow>
                                            ) : (
                                                details.jrs.map((item, idx) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="font-medium">{item.position_jr}</TableCell>
                                                        <TableCell>{item.status_jr}</TableCell>
                                                        <TableCell>{formatDate(item.created_at)}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="sm" asChild>
                                                                <Link href={`/requisitions/manage/${item.jr_id}`} target="_blank">
                                                                    View <ExternalLink className="ml-2 h-4 w-4" />
                                                                </Link>
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}

export default function KPIDetailPage() {
    return (
        <Suspense fallback={<div className="p-8">Loading details...</div>}>
            <KPIDetailContent />
        </Suspense>
    );
}
