'use client'

import React from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle2, XCircle, Info, Building2, Briefcase } from 'lucide-react'
import { cn } from "@/lib/utils"

type VerificationDialogProps = {
    isOpen: boolean
    onClose: () => void
    node: any
    chartCompanyName: string
    onConfirmMatch: (nodeId: string) => void
    onFlagError: (nodeId: string) => void
    isProcessing?: boolean
}

export function VerificationDialog({
    isOpen,
    onClose,
    node,
    chartCompanyName,
    onConfirmMatch,
    onFlagError,
    isProcessing = false
}: VerificationDialogProps) {
    if (!node) return null;

    const status = node.match_status
    const current = node.current_experience
    
    const isCompanyMismatch = status === 'mismatch_company'
    const isPositionMismatch = status === 'mismatch_position'

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-1">
                        <div className={cn(
                            "p-2 rounded-full",
                            isCompanyMismatch ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"
                        )}>
                            <AlertTriangle size={20} />
                        </div>
                        <DialogTitle className="text-xl">Verify Candidate Info</DialogTitle>
                    </div>
                    <DialogDescription className="text-sm font-medium">
                        {isCompanyMismatch 
                            ? "We detected that this candidate might be working at a different company."
                            : "The candidate's current position doesn't perfectly match the OrgChart title."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Comparison Table */}
                    <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50/50">
                        <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 bg-slate-100/50">
                            <div className="p-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">OrgChart Data</div>
                            <div className="p-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">ATS / Database Data</div>
                        </div>

                        {/* Company Row */}
                        <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200">
                            <div className="p-3 flex flex-col gap-1">
                                <span className="text-[10px] text-slate-400 flex items-center gap-1 uppercase font-bold">
                                    <Building2 size={10} /> Company
                                </span>
                                <span className="text-sm font-semibold truncate" title={chartCompanyName}>
                                    {chartCompanyName}
                                </span>
                            </div>
                            <div className={cn(
                                "p-3 flex flex-col gap-1",
                                isCompanyMismatch ? "bg-rose-50/50" : ""
                            )}>
                                <span className="text-[10px] text-slate-400 flex items-center gap-1 uppercase font-bold">
                                    <Building2 size={10} /> Candidate&apos;s Current
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        "text-sm font-semibold truncate",
                                        isCompanyMismatch ? "text-rose-600" : "text-emerald-600"
                                    )} title={current?.company || 'Unknown'}>
                                        {current?.company || 'Unknown'}
                                    </span>
                                    {isCompanyMismatch ? <XCircle size={14} className="text-rose-500 shrink-0" /> : <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
                                </div>
                            </div>
                        </div>

                        {/* Position Row */}
                        <div className="grid grid-cols-2 divide-x divide-slate-200">
                            <div className="p-3 flex flex-col gap-1">
                                <span className="text-[10px] text-slate-400 flex items-center gap-1 uppercase font-bold">
                                    <Briefcase size={10} /> Position / Title
                                </span>
                                <span className="text-sm font-semibold truncate" title={node.title}>
                                    {node.title || 'Not Set'}
                                </span>
                            </div>
                            <div className={cn(
                                "p-3 flex flex-col gap-1",
                                isPositionMismatch ? "bg-amber-50/50" : ""
                            )}>
                                <span className="text-[10px] text-slate-400 flex items-center gap-1 uppercase font-bold">
                                    <Briefcase size={10} /> ATS Experience
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        "text-sm font-semibold truncate",
                                        isPositionMismatch ? "text-amber-600" : "text-emerald-600"
                                    )} title={current?.position || 'Unknown'}>
                                        {current?.position || 'Unknown'}
                                    </span>
                                    {isPositionMismatch ? <Info size={14} className="text-amber-500 shrink-0" /> : <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Reasoning Alert */}
                    <div className={cn(
                        "p-3 rounded-lg border flex gap-3 items-start",
                        isCompanyMismatch ? "bg-rose-50 border-rose-200" : "bg-amber-50 border-amber-200"
                    )}>
                        {isCompanyMismatch ? (
                            <>
                                <XCircle className="text-rose-600 shrink-0 mt-0.5" size={16} />
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-rose-800 uppercase">Action Required</p>
                                    <p className="text-xs text-rose-700 leading-relaxed">
                                        The candidate is currently mapped to <strong>{current?.company}</strong> in our records, while this chart is for <strong>{chartCompanyName}</strong>. Please verify if they are the same person.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                <Info className="text-amber-600 shrink-0 mt-0.5" size={16} />
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-amber-800 uppercase">Position Refinement</p>
                                    <p className="text-xs text-amber-700 leading-relaxed">
                                        The candidate works at the correct company, but their position in ATS is <strong>&quot;{current?.position}&quot;</strong>. Should we verify them as a match for <strong>&quot;{node.title}&quot;</strong>?
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
                    <Button 
                        variant="ghost" 
                        onClick={onClose} 
                        className="sm:mr-auto text-slate-500"
                        disabled={isProcessing}
                    >
                        Back
                    </Button>
                    <div className="flex gap-2">
                        <Button 
                            variant="outline" 
                            className="border-rose-500 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            onClick={() => onFlagError(node.node_id)}
                            disabled={isProcessing}
                        >
                            Flag as Error
                        </Button>
                        <Button 
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => onConfirmMatch(node.node_id)}
                            disabled={isProcessing}
                        >
                            Confirm Match
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
