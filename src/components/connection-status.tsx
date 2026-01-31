"use client";

import { Database, Link2, Link2Off, Cpu } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export function ConnectionStatus() {
    const [supabaseOk, setSupabaseOk] = useState<boolean | null>(null);

    useEffect(() => {
        async function checkSupabase() {
            try {
                const { error } = await supabase.from('candidate_profile').select('candidate_id').limit(1);
                setSupabaseOk(!error);
            } catch {
                setSupabaseOk(false);
            }
        }
        checkSupabase();
    }, []);

    return (
        <div className="flex items-center gap-3 px-3 py-1 bg-secondary/30 rounded-full border border-border/50">
            <div className="flex items-center gap-1.5" title={supabaseOk ? "Supabase Connected" : "Supabase Disconnected"}>
                <Database className={supabaseOk ? "h-3 w-3 text-emerald-500" : "h-3 w-3 text-destructive"} />
                <div className={`h-1.5 w-1.5 rounded-full ${supabaseOk ? "bg-emerald-500 animate-pulse" : "bg-destructive"}`} />
            </div>
            <div className="w-[1px] h-3 bg-border" />
            <div className="flex items-center gap-1.5" title="n8n Bridge (Simulated)">
                <Cpu className="h-3 w-3 text-blue-400" />
                <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
            </div>
        </div>
    );
}
