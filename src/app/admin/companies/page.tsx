"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import CompanyManagementClient from "@/components/admin/CompanyManagementClient";
import { getCompanySidebarStats } from "@/app/actions/company-mgmt";

export default async function CompanyManagementPage() {
    // Initial fetch for sidebar stats (fast)
    const sidebarStats = await getCompanySidebarStats();

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50/50">
            <div className="p-6 border-b bg-white">
                <div className="max-w-[1600px] mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Company Master Database</h1>
                        <p className="text-slate-500 text-sm mt-1">Manage canonical company names, industries, and variations.</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                <div className="max-w-[1600px] mx-auto h-full p-6">
                    <CompanyManagementClient initialStats={sidebarStats} />
                </div>
            </div>
        </div>
    );
}
