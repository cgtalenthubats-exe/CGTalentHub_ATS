'use client'

import React, { useEffect, useState } from 'react'
import { getCandidateOrgCharts } from '@/app/actions/org-chart-actions'
import { Network, ChevronDown, Plus, Ban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AssignCandidateOrgDialog } from './org-chart/assign-candidate-org-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type OrgChartLink = {
    upload_id: string
    company_name: string
    company_logo: string | null
}

export function CandidateOrgChartButton({ 
    candidateId, 
    candidateName, 
    linkedin,
    initialCharts = null,
    initialLoading = false
}: { 
    candidateId: string,
    candidateName: string,
    linkedin: string | null,
    initialCharts?: OrgChartLink[] | null,
    initialLoading?: boolean
}) {
    const [charts, setCharts] = useState<OrgChartLink[]>(initialCharts || [])
    const [loading, setLoading] = useState(initialCharts === null ? true : initialLoading)
    const [isAssignOpen, setIsAssignOpen] = useState(false)

    useEffect(() => {
        // If initialCharts is provided, we don't need to fetch
        if (initialCharts !== null) {
            setCharts(initialCharts)
            setLoading(initialLoading)
            return
        }

        if (!candidateId) return
        
        let mounted = true
        setLoading(true)
        getCandidateOrgCharts(candidateId).then(data => {
            if (mounted) {
                setCharts(data)
                setLoading(false)
            }
        }).catch(err => {
            console.error('Failed to fetch org charts:', err)
            if (mounted) setLoading(false)
        })

        return () => { mounted = false }
    }, [candidateId, initialCharts, initialLoading])

    if (loading) return (
        <Button variant="ghost" disabled className="h-8 w-8 p-0 opacity-40">
            <Network className="h-4 w-4 animate-pulse text-slate-400" />
        </Button>
    )

    // COMPACT DESIGN: RED for "Missing", BLUE for "Present"
    if (charts.length === 0) {
        return (
            <>
                <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-rose-50 text-rose-400 hover:text-rose-600 transition-all group relative shrink-0"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsAssignOpen(true);
                    }}
                    title="Not in Org Chart - Click to Add"
                >
                    <Network className="h-4 w-4 opacity-50 group-hover:opacity-100" />
                    <Plus className="h-2.5 w-2.5 absolute top-1 right-1 font-bold" />
                </Button>

                <AssignCandidateOrgDialog 
                    isOpen={isAssignOpen}
                    onOpenChange={setIsAssignOpen}
                    candidateId={candidateId}
                    candidateName={candidateName}
                    linkedin={linkedin}
                />
            </>
        )
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-indigo-50 text-indigo-500 hover:text-indigo-700 transition-all shrink-0"
                    onClick={(e) => e.stopPropagation()}
                    title={`Present in ${charts.length} Org Chart${charts.length > 1 ? 's' : ''}`}
                >
                    <Network className="h-4 w-4" />
                    {charts.length > 1 && (
                        <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[8px] font-bold h-3.5 min-w-[14px] px-0.5 rounded-full flex items-center justify-center border border-white">
                            {charts.length}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuLabel className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-3 pt-2">Org Chart Membership</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {charts.map((chart: OrgChartLink) => (
                    <DropdownMenuItem 
                        key={chart.upload_id}
                        className="flex items-center gap-3 cursor-pointer py-2 px-3 hover:bg-slate-50 focus:bg-slate-50"
                        onClick={() => window.open(`/org-chart?id=${chart.upload_id}`, '_blank')}
                    >
                        {chart.company_logo ? (
                            <img src={chart.company_logo} alt={chart.company_name} className="h-6 w-6 object-contain rounded-sm" />
                        ) : (
                            <div className="h-6 w-6 rounded-sm bg-indigo-50 flex items-center justify-center shrink-0">
                                <Network className="h-3.5 w-3.5 text-indigo-400" />
                            </div>
                        )}
                        <span className="font-medium text-xs text-slate-700 line-clamp-1">{chart.company_name}</span>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
