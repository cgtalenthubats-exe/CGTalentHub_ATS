"use client";

import React, { useEffect, useState } from "react";
import {
  Users,
  Briefcase,
  TrendingUp,
  History,
  ChevronRight,
  UserCircle,
  BarChart3,
  Clock,
  FileText,
  Database
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { getTrackingData, TrackingStats } from "@/app/actions/tracking";
import OverviewAnalytics from "./OverviewAnalytics";
import OrgChartAlerts from "./OrgChartAlerts";

interface Metrics {
  totalCandidates: number;
  activeJobs: number;
  totalJRs: number;
  inactiveJobs: number;
  resumeCount: number;
  orgChartCount: number;
  interviewsThisWeek: number;
}

export default function OverviewPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics>({
    totalCandidates: 0,
    activeJobs: 0,
    totalJRs: 0,
    inactiveJobs: 0,
    resumeCount: 0,
    orgChartCount: 0,
    interviewsThisWeek: 12,
  });
  const [tracking, setTracking] = useState<TrackingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // 1. Fetch Global Stats
        const res = await fetch('/api/stats');
        const data = await res.json();

        // 2. Fetch Tracking Data for Funnel (Global)
        const trackData = await getTrackingData({});
        setTracking(trackData);

        setMetrics({
          totalCandidates: data.totalCandidates || 0,
          activeJobs: data.activeJobs || 0,
          totalJRs: data.totalJRs || 0,
          inactiveJobs: data.inactiveJobs || 0,
          resumeCount: data.resumeCount || 0,
          orgChartCount: data.orgChartCount || 0,
          interviewsThisWeek: 12,
        });

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="flex flex-col gap-10 bg-slate-50/30 p-4 -m-4 rounded-3xl min-h-screen">
      {/* Welcome Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Overview</h1>
        <p className="text-lg text-slate-500 font-medium">CG Talent Hub Intelligence Platform.</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm font-bold flex items-center gap-2">
          <History className="h-4 w-4" /> System Alert: {error}
        </div>
      )}

      {/* Premium Stats Grid */}
      <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-5">
        <Card className="relative overflow-hidden group border-none bg-white ring-1 ring-slate-200 shadow-xl transition-all hover:shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Global Talent Pool</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black tracking-tighter text-slate-900">
              {loading ? "..." : metrics.totalCandidates.toLocaleString()}
            </div>
            <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-emerald-500 uppercase">
              <TrendingUp className="h-3 w-3" /> Growth: Active
            </div>
          </CardContent>
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
            <Users className="w-12 h-12" />
          </div>
        </Card>

        <Card className="relative overflow-hidden group border-none bg-white ring-1 ring-slate-200 shadow-xl transition-all hover:shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Resumes in System</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black tracking-tighter text-slate-900">
              {loading ? "..." : metrics.resumeCount.toLocaleString()}
            </div>
            <div className="mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              Verified documents
            </div>
          </CardContent>
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
            <FileText className="w-12 h-12" />
          </div>
        </Card>

        <Card className="relative overflow-hidden group border-none bg-white ring-1 ring-slate-200 shadow-xl transition-all hover:shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black text-amber-500 uppercase tracking-widest">OrgChart Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black tracking-tighter text-slate-900">
              {loading ? "..." : metrics.orgChartCount.toLocaleString()}
            </div>
            <div className="mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              Structure Uploads
            </div>
          </CardContent>
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
            <Database className="w-12 h-12" />
          </div>
        </Card>

        <Card className="relative overflow-hidden group border-none bg-white ring-1 ring-slate-200 shadow-xl transition-all hover:shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Job Requisitions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black tracking-tighter text-slate-900">
              {loading ? "..." : metrics.totalJRs.toLocaleString()}
            </div>
            <div className="mt-4 text-[10px] font-bold flex gap-3 text-slate-500 uppercase">
              <span className="text-indigo-600 font-black">{metrics.activeJobs} ACTIVE</span>
              <span className="opacity-40">|</span>
              <span className="text-slate-400 font-black">{metrics.inactiveJobs} CLOSED</span>
            </div>
          </CardContent>
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
            <Briefcase className="w-12 h-12" />
          </div>
        </Card>

        <Card className="relative overflow-hidden group border-none bg-white ring-1 ring-slate-200 shadow-xl transition-all hover:shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black text-rose-500 uppercase tracking-widest">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black tracking-tighter text-slate-900">98%</div>
            <div className="mt-4 text-[10px] font-bold text-rose-500 uppercase tracking-wide">
              Operating Normally
            </div>
          </CardContent>
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-12 h-12" />
          </div>
        </Card>
      </div>

      <div className="mt-6 animate-in slide-in-from-bottom-6 duration-1000 delay-300">
          <OverviewAnalytics />
      </div>

      {/* Main Insights section */}
      <div className="grid gap-8 lg:grid-cols-5 pt-8 border-t border-slate-100 italic">
        <div className="lg:col-span-5 mb-2">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-indigo-500" />
                Pipeline Performance
            </h3>
        </div>
        <Card className="lg:col-span-3 border-none ring-1 ring-slate-200 bg-white shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader className="border-b bg-slate-50 px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-xl font-black tracking-tight text-slate-800">Recruitment Funnel</CardTitle>
                <CardDescription className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Real-time candidate distribution</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-[10px] font-black uppercase tracking-widest bg-white"
                onClick={() => router.push('/requisitions/tracking')}
              >
                Full Analytics <BarChart3 className="ml-2 w-3.5 h-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            {loading ? (
              <div className="h-[300px] w-full flex items-center justify-center animate-pulse bg-slate-50 rounded-2xl" />
            ) : (
              tracking?.funnelData.slice(0, 6).map((stage) => (
                <div key={stage.status} className="space-y-2 group">
                  <div className="flex justify-between items-end">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-4 rounded-full" style={{ backgroundColor: stage.color || '#cbd5e1' }} />
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider font-mono">{stage.status}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[9px] font-bold text-slate-400">AVG: {stage.avgDays} days</span>
                      <span className="text-xl font-black text-slate-900">{stage.count}</span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm"
                      style={{
                        width: `${tracking.funnelData[0]?.count > 0 ? (stage.count / tracking.funnelData[0].count) * 100 : 0}%`,
                        backgroundColor: stage.color || '#6366f1'
                      }}
                    />
                  </div>
                </div>
              ))
            )}
            {!loading && (!tracking || tracking.funnelData.length === 0) && (
              <div className="h-[300px] flex flex-col items-center justify-center text-slate-400 gap-2">
                <Briefcase className="w-12 h-12 opacity-20" />
                <p className="text-xs font-bold uppercase tracking-widest">No recruitment data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-none ring-1 ring-slate-200 bg-white shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader className="border-b bg-slate-50 px-8 py-6 fle flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-black tracking-tight text-slate-800">Status Aging</CardTitle>
              <CardDescription className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Average days per stage</CardDescription>
            </div>
            <Clock className="h-5 w-5 text-slate-400" />
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-900 text-slate-100">
                <tr>
                  <th className="px-6 py-3 text-left font-black uppercase tracking-widest">Stage</th>
                  <th className="px-6 py-3 text-center font-black uppercase tracking-widest">Mean</th>
                  <th className="px-6 py-3 text-center font-black uppercase tracking-widest">Peak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tracking?.funnelData.filter(d => d.count > 0).map((d) => (
                  <tr key={d.status} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-700 uppercase tracking-tighter">{d.status}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-black font-mono">{d.avgDays}d</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-rose-50 text-rose-700 px-2 py-1 rounded-md font-black font-mono">{d.maxDays}d</span>
                    </td>
                  </tr>
                ))}
                {!loading && tracking?.funnelData.filter(d => d.count > 0).length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-20 text-center text-slate-300 italic text-xs">
                      No active recruitment cycles to track aging
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* OrgChart Verification Tasks at the bottom */}
      <div className="mt-12 pt-8 border-t border-slate-100">
          <OrgChartAlerts />
      </div>
    </div>
  );
}
