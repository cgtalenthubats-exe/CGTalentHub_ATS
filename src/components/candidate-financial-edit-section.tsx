"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatNumberWithCommas } from "@/lib/utils";

export function FinancialEditSection({ candidate, onSave }: { candidate: any; onSave: (fields: Record<string, any>) => Promise<void> }) {
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [draft, setDraft] = useState({
        gross_salary_base_b_mth: '', bonus_mth: '', other_income: '',
        car_allowance_b_mth: '', gasoline_b_mth: '', phone_b_mth: '',
        provident_fund_pct: '', insurance: '', medical_b_annual: '',
        medical_b_mth: '', housing_for_expat_b_mth: '', others_benefit: '',
    });

    useEffect(() => {
        setDraft({
            gross_salary_base_b_mth: candidate?.gross_salary_base_b_mth?.toString() || '',
            bonus_mth: candidate?.bonus_mth?.toString() || '',
            other_income: candidate?.other_income || '',
            car_allowance_b_mth: candidate?.car_allowance_b_mth?.toString() || '',
            gasoline_b_mth: candidate?.gasoline_b_mth?.toString() || '',
            phone_b_mth: candidate?.phone_b_mth?.toString() || '',
            provident_fund_pct: candidate?.provident_fund_pct?.toString() || '',
            insurance: candidate?.insurance || '',
            medical_b_annual: candidate?.medical_b_annual?.toString() || '',
            medical_b_mth: candidate?.medical_b_mth?.toString() || '',
            housing_for_expat_b_mth: candidate?.housing_for_expat_b_mth || '',
            others_benefit: candidate?.others_benefit || '',
        });
    }, [candidate]);

    const handleSave = async () => {
        setSaving(true);
        const numFields = ['gross_salary_base_b_mth', 'car_allowance_b_mth', 'gasoline_b_mth', 'phone_b_mth', 'medical_b_annual', 'medical_b_mth'];
        const payload: Record<string, any> = {};
        (Object.keys(draft) as (keyof typeof draft)[]).forEach(k => {
            const v = draft[k];
            payload[k] = numFields.includes(k) ? (v ? parseFloat(v.replace(/,/g, '')) || null : null) : (v || null);
        });
        await onSave(payload);
        setSaving(false);
        setEditing(false);
    };

    const inputCls = "w-full h-7 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-300";

    const fields: { key: keyof typeof draft; label: string; type?: string; span?: boolean }[] = [
        { key: 'gross_salary_base_b_mth', label: 'Salary (฿/M)', type: 'number' },
        { key: 'bonus_mth', label: 'Bonus (m)' },
        { key: 'other_income', label: 'Other Inc.' },
        { key: 'car_allowance_b_mth', label: 'Car (฿/M)', type: 'number' },
        { key: 'gasoline_b_mth', label: 'Gas (฿/M)', type: 'number' },
        { key: 'phone_b_mth', label: 'Phone (฿/M)', type: 'number' },
        { key: 'provident_fund_pct', label: 'PFund (%)' },
        { key: 'insurance', label: 'Insurance' },
        { key: 'medical_b_annual', label: 'Med (฿/Yr)', type: 'number' },
        { key: 'medical_b_mth', label: 'Med (฿/M)', type: 'number' },
        { key: 'housing_for_expat_b_mth', label: 'Housing / Expat', span: true },
    ];

    return (
        <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                Financial Profile & Benefits
                <button
                    onClick={() => setEditing(e => !e)}
                    className="ml-auto text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                >
                    {editing ? 'Cancel' : 'Edit'}
                </button>
            </h3>
            <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100/50">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5 text-sm">
                    {fields.map(({ key, label, type, span }) => (
                        <div key={key} className={cn("space-y-1", span && "md:col-span-2")}>
                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest text-slate-400">{label}</p>
                            {editing ? (
                                <input
                                    type={type || 'text'}
                                    value={draft[key]}
                                    onChange={e => setDraft(prev => ({ ...prev, [key]: e.target.value }))}
                                    className={inputCls}
                                    placeholder="—"
                                />
                            ) : (
                                key === 'gross_salary_base_b_mth' ? (
                                    <p className="font-bold text-base text-emerald-600">
                                        {candidate?.[key] ? `฿${formatNumberWithCommas(candidate[key])}` : '-'}
                                    </p>
                                ) : key === 'insurance' ? (
                                    <div className="flex flex-wrap gap-1">
                                        {candidate?.insurance ? candidate.insurance.split(',').map((item: string, i: number) => (
                                            <span key={i} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-bold border border-indigo-100 uppercase">{item.trim()}</span>
                                        )) : '-'}
                                    </div>
                                ) : ['car_allowance_b_mth', 'gasoline_b_mth', 'phone_b_mth', 'medical_b_annual', 'medical_b_mth'].includes(key) ? (
                                    <p className="font-bold text-slate-700">{candidate?.[key] ? `฿${formatNumberWithCommas(candidate[key])}` : '-'}</p>
                                ) : key === 'bonus_mth' ? (
                                    <p className="font-bold text-slate-700">{candidate?.bonus_mth ? `${candidate.bonus_mth} m` : '-'}</p>
                                ) : key === 'provident_fund_pct' ? (
                                    <p className="font-bold text-slate-700">{candidate?.provident_fund_pct ? `${candidate.provident_fund_pct}%` : '-'}</p>
                                ) : (
                                    <p className="font-bold text-slate-700 truncate" title={candidate?.[key]}>{candidate?.[key] || '-'}</p>
                                )
                            )}
                        </div>
                    ))}
                </div>

                {/* Others benefit row */}
                <div className="mt-4 space-y-1">
                    <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Additional Benefits Pool</p>
                    {editing ? (
                        <textarea
                            value={draft.others_benefit}
                            onChange={e => setDraft(prev => ({ ...prev, others_benefit: e.target.value }))}
                            rows={2}
                            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-300 resize-none"
                            placeholder="Describe other benefits..."
                        />
                    ) : candidate?.others_benefit ? (
                        <p className="text-xs font-medium text-slate-600 leading-relaxed italic">&ldquo;{candidate.others_benefit}&rdquo;</p>
                    ) : (
                        <p className="font-bold text-slate-700">-</p>
                    )}
                </div>

                {editing && (
                    <div className="mt-5 flex justify-end">
                        <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 px-5 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white">
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save Changes'}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
