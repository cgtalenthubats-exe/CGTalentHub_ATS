"use client";

import React, { useEffect, useState } from "react";
import {
  Users,
  Briefcase,
  Calendar,
  TrendingUp,
  History,
  ChevronRight,
  UserCircle
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Metrics {
  totalCandidates: number;
  activeJobs: number;
  inactiveJobs: number;
  interviewsThisWeek: number;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics>({
    totalCandidates: 0,
    activeJobs: 0,
    inactiveJobs: 0,
    interviewsThisWeek: 12,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        setLoading(true);
        // Fetch from internal API to bypass RLS using Service Role
        const res = await fetch('/api/stats');
        const data = await res.json();

        if (data.error) throw new Error(data.error);

        setMetrics(prev => ({
          ...prev,
          totalCandidates: data.totalCandidates,
          activeJobs: data.activeJobs,
          inactiveJobs: data.inactiveJobs,
        }));

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchMetrics();
  }, []);

  return (
    <div className="flex flex-col gap-10">
      {/* Welcome Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight">Overview</h1>
        <p className="text-lg text-muted-foreground font-medium">CG Talent Hub Thailand Intelligence Platform.</p>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-destructive text-sm font-bold flex items-center gap-2">
          <History className="h-4 w-4" /> System Alert: {error}
        </div>
      )}

      {/* Premium Stats Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="relative overflow-hidden group border-none bg-gradient-to-br from-blue-500/5 to-transparent ring-1 ring-border shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-blue-500 uppercase tracking-widest">Global Talent Pool</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black tracking-tighter">
              {loading ? "..." : metrics.totalCandidates}
            </div>
            <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-emerald-500 uppercase">
              <TrendingUp className="h-3 w-3" /> Growth: +12.5%
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden group border-none bg-gradient-to-br from-purple-500/5 to-transparent ring-1 ring-border shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-purple-500 uppercase tracking-widest">Open Requisitions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black tracking-tighter">
              {loading ? "..." : metrics.activeJobs}
            </div>
            <div className="mt-4 text-[10px] font-bold flex gap-3 text-muted-foreground uppercase">
              <span className="text-purple-500">{metrics.activeJobs} ACTIVE</span>
              <span>{metrics.inactiveJobs} TOTAL INACTIVE</span>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden group border-none bg-gradient-to-br from-pink-500/5 to-transparent ring-1 ring-border shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-pink-500 uppercase tracking-widest">Active Interviews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black tracking-tighter">{metrics.interviewsThisWeek}</div>
            <div className="mt-4 text-[10px] font-bold text-pink-500 uppercase tracking-wide">
              Priority: 3 Critical Today
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Insights section */}
      <div className="grid gap-8 lg:grid-cols-5">
        <Card className="lg:col-span-3 border-none ring-1 ring-border bg-card shadow-xl rounded-3xl">
          <CardHeader>
            <CardTitle className="text-xl font-bold tracking-tight">Recruitment Funnel</CardTitle>
            <CardDescription>Visualizing candidate stage distribution</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-8">
            {[
              { label: 'Applied', value: 145, max: 150, color: 'bg-blue-500' },
              { label: 'Screening', value: 82, max: 150, color: 'bg-indigo-500' },
              { label: 'Tech Assessment', value: 34, max: 150, color: 'bg-purple-500' },
              { label: 'Offer Stage', value: 12, max: 150, color: 'bg-emerald-500' }
            ].map((stage) => (
              <div key={stage.label} className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-black uppercase text-muted-foreground">{stage.label}</span>
                  <span className="text-xl font-black">{stage.value}</span>
                </div>
                <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-1000", stage.color)}
                    style={{ width: `${(stage.value / stage.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-none ring-1 ring-border bg-card shadow-xl rounded-3xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-bold tracking-tight">System Pulse</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-4 items-start group">
                <div className="h-10 w-10 shrink-0 rounded-2xl bg-secondary/50 flex items-center justify-center border border-border group-hover:border-primary/30 transition-all">
                  <UserCircle className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold group-hover:text-primary transition-colors">Candidate ID: {1000 + i}</span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Stage updated to <b>Screening</b> by Recruiter.
                  </p>
                  <span className="text-[9px] font-bold text-muted-foreground tracking-tighter mt-1 opacity-50">2 HOURS AGO</span>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full mt-6 rounded-2xl text-[10px] font-black uppercase tracking-widest gap-2">
              View Audit Log <ChevronRight className="h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
