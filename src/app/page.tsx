"use client";

import React, { useEffect, useState } from "react";
import {
  Users,
  Briefcase,
  TrendingUp,
  History,
  ChevronRight,
  UserCircle,
  FileText,
  Database,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { getTrackingData, TrackingStats } from "@/app/actions/tracking";
import OverviewAnalytics from "./OverviewAnalytics";

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

        {/* This card space removed - System Health */}
      </div>

      <div className="mt-6 animate-in slide-in-from-bottom-6 duration-1000 delay-300">
          <OverviewAnalytics />
      </div>
    </div>
  );
}
