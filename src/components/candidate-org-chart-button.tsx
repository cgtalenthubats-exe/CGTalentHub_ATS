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
    linkedin 
}: { 
    candidateId: string,
    candidateName: string,
    linkedin: string | null 
}) {
    const [charts, setCharts] = useState<OrgChartLink[]>([])
    const [loading, setLoading] = useState(true)
    const [isAssignOpen, setIsAssignOpen] = useState(false)

    useEffect(() => {
        if (!candidateId) return
        
        let mounted = true
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
    }, [candidateId])

    if (loading) return (
        <Button variant="outline" disabled className="h-10 px-3 gap-2 opacity-50">
            <Network className="h-4 w-4 animate-pulse" />
        </Button>
    )

    if (charts.length === 0) {
        return (
            <>
                <Button 
                    variant="outline" 
                    className="h-10 px-3 gap-2 border-rose-100 bg-rose-50/30 hover:bg-rose-50 hover:border-rose-300 text-rose-600 transition-all shadow-sm group"
                    onClick={() => setIsAssignOpen(true)}
                >
                    <div className="relative">
                        <Network className="h-5 w-5 opacity-40" />
                        <Ban className="h-3 w-3 text-rose-600 absolute -top-1 -right-1 fill-white rounded-full" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-tight hidden sm:inline-block">
                        NOT IN ORG CHART
                    </span>
                    <Plus className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity" />
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
                <Button variant="outline" className="h-10 px-3 gap-2 border-slate-200 hover:border-indigo-300 hover:bg-slate-50 transition-colors shadow-sm">
                    <Network className="h-5 w-5 text-indigo-500" />
                    <span className="text-xs font-bold text-slate-700 hidden sm:inline-block">
                        Org Chart{charts.length > 1 ? 's' : ''} {charts.length > 1 ? `(${charts.length})` : ''}
                    </span>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs text-slate-500 font-bold uppercase tracking-wider">Present In OrgCharts</DropdownMenuLabel>
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
                        <span className="font-medium text-sm text-slate-800 line-clamp-1">{chart.company_name}</span>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
