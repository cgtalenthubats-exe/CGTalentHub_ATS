"use client";

import React, { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import { getKPIData, KPIRawData } from "@/app/actions/kpi-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface RecruiterKPI {
    email: string;
    sourced: number;
    prescreens: number;
    interviews: number;
    jrsOwned: number;
}

export default function KPIDashboardDemo() {
    const [rawData, setRawData] = useState<KPIRawData | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [showInfo, setShowInfo] = useState(false);

    useEffect(() => {
        getKPIData().then(data => {
            setRawData(data);
            setLoading(false);
        });
    }, []);

    // Process data
    const processKPI = (): RecruiterKPI[] => {
        if (!rawData) return [];

        const kpiMap = new Map<string, RecruiterKPI>();
        const profileMap = new Map<string, string>();

        // Build resolving map from user_profiles
        if (rawData.profiles) {
            rawData.profiles.forEach(p => {
                if (p.email) profileMap.set(p.email.toLowerCase().trim(), p.real_name);
                if (p.real_name) profileMap.set(p.real_name.toLowerCase().trim(), p.real_name);
            });
        }

        // Custom legacy aliases
        const customAliases: Record<string, string> = {
            "system import": "Admin2",
            "admin@cgtalent.com": "Admin2",
            "admin2": "Admin2"
        };

        const ensureRecruiter = (identifier: string | null) => {
            const safeIdentifier = identifier || "Unknown";
            const rawStr = safeIdentifier.toLowerCase().trim();
            
            // 1. Check custom aliases first
            if (customAliases[rawStr]) {
                const displayName = customAliases[rawStr];
                if (!kpiMap.has(displayName)) {
                    kpiMap.set(displayName, { email: displayName, sourced: 0, prescreens: 0, interviews: 0, jrsOwned: 0 });
                }
                return displayName;
            }

            // 2. Resolve to real_name from user_profiles if exists
            let displayName = profileMap.get(rawStr) || safeIdentifier;
            
            // 3. Format fallback: Title Case if it's not an email
            if (!displayName.includes('@') && displayName !== "Unknown") {
                displayName = displayName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            }

            if (!kpiMap.has(displayName)) {
                kpiMap.set(displayName, { email: displayName, sourced: 0, prescreens: 0, interviews: 0, jrsOwned: 0 });
            }
            return displayName;
        };

        // Sourcing
        rawData.sourcing.forEach(s => {
            const email = ensureRecruiter(s.created_by);
            kpiMap.get(email)!.sourced += 1;
        });

        // Prescreens
        rawData.prescreens.forEach(p => {
            const email = ensureRecruiter(p.screener_Name);
            kpiMap.get(email)!.prescreens += 1;
        });

        // Interviews (Only count if Interviewer_type === 'Recruiter')
        rawData.interviews.forEach(i => {
            if (i.Interviewer_type === 'Recruiter') {
                const email = ensureRecruiter(i.Interviewer_name);
                kpiMap.get(email)!.interviews += 1;
            }
        });

        // JRs Owned
        rawData.jrs.forEach(j => {
            const email = ensureRecruiter(j.create_by);
            kpiMap.get(email)!.jrsOwned += 1;
        });

        return Array.from(kpiMap.values()).sort((a, b) => a.email.localeCompare(b.email)); // Sort alphabetically by Recruiter name
    };

    const kpiData = processKPI().filter(k => k.email.includes(searchTerm.toLowerCase()));

    const totalSourced = kpiData.reduce((acc, curr) => acc + curr.sourced, 0);
    const totalInterviews = kpiData.reduce((acc, curr) => acc + curr.interviews, 0);

    return (
        <div className="p-8 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Recruiter KPI Dashboard (Demo)</h1>
                    <p className="text-gray-500 mt-2">Track performance metrics across sourcing, screening, and JR ownership.</p>
                </div>
                <Button variant="outline" onClick={() => setShowInfo(!showInfo)} className="gap-2">
                    <Info className="h-4 w-4" />
                    {showInfo ? "Hide Metrics Info" : "How are KPIs calculated?"}
                </Button>
            </div>

            {showInfo && (
                <Alert className="bg-blue-50/50 border-blue-200">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-800 font-semibold">KPI Data Sources</AlertTitle>
                    <AlertDescription className="text-blue-700/80 mt-2 space-y-1 text-sm">
                        <p>• <strong>Profiles Sourced:</strong> Total number of candidates added to the database. Tracked via the <code>created_by</code> column in the <code>Candidate Profile</code> table.</p>
                        <p>• <strong>Pre-Screens:</strong> Total initial phone screenings conducted. Tracked via the <code>screener_Name</code> column in the <code>pre_screen_log</code> table.</p>
                        <p>• <strong>Interviews:</strong> Total in-depth interviews conducted by recruiters. Tracked via the <code>Interviewer_name</code> column in the <code>interview_feedback</code> table, counting only records where <code>Interviewer_type</code> is 'Recruiter'.</p>
                        <p>• <strong>JRs Owned:</strong> Total Job Requisitions created and owned by the recruiter. Tracked via the <code>create_by</code> column in the <code>job_requisitions</code> table.</p>
                    </AlertDescription>
                </Alert>
            )}

            {loading ? (
                <div className="flex h-32 items-center justify-center text-gray-500">Loading KPI Data...</div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-500">Total Sourced (All Time)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{totalSourced}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-500">Total Interviews</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{totalInterviews}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-500">Active Recruiters</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{kpiData.length}</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Leaderboard */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Recruiter KPI</CardTitle>
                            <Input 
                                placeholder="Search recruiter email..." 
                                className="max-w-xs" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </CardHeader>
                        <CardContent>
                            <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-gray-50">
                                            <TableHead>Recruiter</TableHead>
                                            <TableHead className="text-right">Profiles Sourced</TableHead>
                                            <TableHead className="text-right">Pre-Screens</TableHead>
                                            <TableHead className="text-right">Interviews</TableHead>
                                            <TableHead className="text-right">JRs Owned</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {kpiData.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                                                    No KPI data found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            kpiData.map((row) => (
                                                <TableRow key={row.email}>
                                                    <TableCell className="font-medium">
                                                        <Link 
                                                            href={`/kpi-demo/details?recruiter=${encodeURIComponent(row.email)}`}
                                                            className="text-blue-600 hover:text-blue-800 hover:underline"
                                                        >
                                                            {row.email}
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell className="text-right text-blue-600 font-semibold">{row.sourced}</TableCell>
                                                    <TableCell className="text-right">{row.prescreens}</TableCell>
                                                    <TableCell className="text-right">{row.interviews}</TableCell>
                                                    <TableCell className="text-right">{row.jrsOwned}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
