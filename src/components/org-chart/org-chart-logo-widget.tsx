'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Loader2, UploadCloud, Trash2, Building2, FileImage } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/notifications'
import { supabase } from '@/lib/supabase/client'
import { updateMasterCompanyLogo, updateChartLogo } from '@/app/actions/org-chart-actions'

type Scope = 'chart' | 'company'

const MAX_LOGO_BYTES = 5 * 1024 * 1024

type Props = {
    uploadId?: string | null
    companyId?: string | null
    companyName: string
    /** Shared logo stored on company_master */
    companyLogoUrl?: string | null
    /** Per-chart override stored on org_chart_uploads.chart_logo */
    chartLogoUrl?: string | null
    /** Called with the logo that is actually shown (chart override ?? company logo) */
    onEffectiveLogoChange?: (url: string | null) => void
}

/**
 * Top-left logo + company-name widget of the org chart viewers.
 * Effective logo = chart override ?? company logo. Both can be uploaded, replaced and removed.
 */
export function OrgChartLogoWidget({
    uploadId,
    companyId,
    companyName,
    companyLogoUrl: initialCompanyLogo,
    chartLogoUrl: initialChartLogo,
    onEffectiveLogoChange,
}: Props) {
    const [companyLogo, setCompanyLogo] = useState<string | null>(initialCompanyLogo || null)
    const [chartLogo, setChartLogo] = useState<string | null>(initialChartLogo || null)
    const [busy, setBusy] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const scopeRef = useRef<Scope>('chart')

    // Re-sync when server props change (router.refresh(), switching chart/company)
    useEffect(() => { setCompanyLogo(initialCompanyLogo || null) }, [initialCompanyLogo])
    useEffect(() => { setChartLogo(initialChartLogo || null) }, [initialChartLogo])

    const effective = chartLogo || companyLogo
    useEffect(() => { onEffectiveLogoChange?.(effective) }, [effective]) // eslint-disable-line react-hooks/exhaustive-deps

    const canEditChart = !!uploadId
    const canEditCompany = !!companyId

    const pickFile = (scope: Scope) => {
        scopeRef.current = scope
        inputRef.current?.click()
    }

    const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = '' // allow re-selecting the same file later
        if (!file) return
        const scope = scopeRef.current

        if (!file.type.startsWith('image/')) {
            toast.error('กรุณาเลือกไฟล์รูปภาพเท่านั้น')
            return
        }
        if (file.size > MAX_LOGO_BYTES) {
            toast.error('ไฟล์ใหญ่เกินไป (สูงสุด 5MB)')
            return
        }
        if ((scope === 'chart' && !uploadId) || (scope === 'company' && !companyId)) {
            toast.error(scope === 'chart' ? 'ไม่พบ chart ที่จะบันทึกโลโก้' : 'Chart นี้ยังไม่ได้ผูกกับ Company')
            return
        }

        setBusy(true)
        let uploadedName: string | null = null
        try {
            const fileExt = file.name.split('.').pop() || 'png'
            const key = scope === 'chart' ? `chart_${uploadId}` : String(companyId)
            const fileName = `logo_${key}_${Date.now()}.${fileExt}`

            const { error: uploadError } = await supabase.storage
                .from('org_charts')
                .upload(fileName, file, { upsert: true })
            if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)
            uploadedName = fileName

            const publicUrl = supabase.storage.from('org_charts').getPublicUrl(fileName).data.publicUrl

            if (scope === 'chart') {
                await updateChartLogo(uploadId as string, publicUrl)
                setChartLogo(publicUrl)
            } else {
                await updateMasterCompanyLogo(String(companyId), publicUrl)
                setCompanyLogo(publicUrl)
            }
            uploadedName = null // saved — keep the file
            toast.success(
                scope === 'chart'
                    ? 'อัปเดตโลโก้ของ chart นี้แล้ว'
                    : chartLogo
                        ? 'อัปเดตโลโก้ของบริษัทแล้ว (chart นี้ยังใช้โลโก้เฉพาะของตัวเองอยู่)'
                        : 'อัปเดตโลโก้ของบริษัทแล้ว'
            )
        } catch (err: any) {
            if (uploadedName) await supabase.storage.from('org_charts').remove([uploadedName]).catch(() => {})
            toast.error('Failed to upload logo: ' + (err?.message ?? 'unknown error'))
        } finally {
            setBusy(false)
        }
    }

    const removeLogo = async (scope: Scope) => {
        if (scope === 'company' && !window.confirm(`ลบโลโก้ของ ${companyName}?\nจะมีผลกับทุก chart ของบริษัทนี้ที่ไม่ได้ตั้งโลโก้เฉพาะ chart`)) return
        setBusy(true)
        try {
            if (scope === 'chart') {
                await updateChartLogo(uploadId as string, null)
                setChartLogo(null)
            } else {
                await updateMasterCompanyLogo(String(companyId), null)
                setCompanyLogo(null)
            }
            toast.success(scope === 'chart' ? 'ลบโลโก้ของ chart นี้แล้ว' : 'ลบโลโก้ของบริษัทแล้ว')
        } catch (err: any) {
            toast.error('Failed to remove logo: ' + (err?.message ?? 'unknown error'))
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5">
            <span className="text-xs font-black text-slate-700 bg-white/90 border border-slate-200 rounded-full px-3 py-1 shadow-sm w-fit">
                {companyName}
            </span>

            <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={busy}>
                    <button
                        type="button"
                        className={cn(
                            "relative group rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden flex items-center justify-center cursor-pointer transition-all",
                            effective ? "h-16 w-32 p-1" : "h-9 px-4 hover:border-indigo-300 hover:bg-slate-50 rounded-full"
                        )}
                        title="Manage logo"
                    >
                        {busy ? (
                            <div className="flex items-center justify-center w-full h-full text-indigo-500">
                                <Loader2 size={16} className="animate-spin" />
                            </div>
                        ) : effective ? (
                            <>
                                <img src={effective} alt="Logo" className="max-h-full max-w-full object-contain" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold">
                                    <UploadCloud size={16} className="mb-0.5" />
                                    EDIT
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold group-hover:text-indigo-600 transition-colors">
                                <UploadCloud size={14} />
                                ADD LOGO
                            </div>
                        )}
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-slate-400">
                        {effective ? (chartLogo ? 'Showing: this chart\'s logo' : 'Showing: company logo') : 'No logo yet'}
                    </DropdownMenuLabel>
                    <DropdownMenuItem disabled={!canEditChart} onSelect={() => pickFile('chart')}>
                        <FileImage size={14} className="mr-2" />
                        {chartLogo ? 'Replace logo (this chart only)' : 'Upload logo (this chart only)'}
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={!canEditCompany} onSelect={() => pickFile('company')}>
                        <Building2 size={14} className="mr-2" />
                        {companyLogo ? 'Replace company logo (all charts)' : 'Upload company logo (all charts)'}
                    </DropdownMenuItem>
                    {!canEditCompany && (
                        <div className="px-2 pb-1 text-[10px] text-amber-600">Chart นี้ยังไม่ได้ผูก Company — ตั้งโลโก้บริษัทไม่ได้</div>
                    )}
                    {(chartLogo || companyLogo) && <DropdownMenuSeparator />}
                    {chartLogo && (
                        <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onSelect={() => removeLogo('chart')}>
                            <Trash2 size={14} className="mr-2" />
                            {companyLogo ? 'Remove chart logo (use company logo)' : 'Remove chart logo'}
                        </DropdownMenuItem>
                    )}
                    {companyLogo && canEditCompany && (
                        <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onSelect={() => removeLogo('company')}>
                            <Trash2 size={14} className="mr-2" />
                            Remove company logo
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <input type="file" accept="image/*" ref={inputRef} className="hidden" onChange={handleFile} />
        </div>
    )
}
