"use client";

import { useState, useEffect } from "react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Building2, Loader2 } from "lucide-react";
import {
    getIndustryGroupOptions,
    getCompanyAffectedCount,
    updateCompanyIndustryGroup,
} from "@/app/actions/company-industry";
import { toast } from "@/lib/notifications";

const CUSTOM = "__custom__";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    companyId: string;
    companyName: string;
    currentIndustry: string;
    currentGroup: string;
    onSaved: () => void;
}

export function CompanyQuickEditDialog({
    open, onOpenChange, companyId, companyName, currentIndustry, currentGroup, onSaved,
}: Props) {
    const [options, setOptions] = useState<{ industry: string; group: string }[]>([]);
    const [groupSelect, setGroupSelect] = useState(currentGroup);
    const [groupCustom, setGroupCustom] = useState('');
    const [industrySelect, setIndustrySelect] = useState(currentIndustry);
    const [industryCustom, setIndustryCustom] = useState('');
    const [affectedCount, setAffectedCount] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setGroupSelect(currentGroup || '');
        setGroupCustom('');
        setIndustrySelect(currentIndustry || '');
        setIndustryCustom('');
        setAffectedCount(null);
        Promise.all([
            getIndustryGroupOptions(),
            getCompanyAffectedCount(companyId),
        ]).then(([opts, count]) => {
            setOptions(opts);
            setAffectedCount(count);
        });
    }, [open, companyId, currentIndustry, currentGroup]);

    const uniqueGroups = Array.from(new Set(options.map(o => o.group))).sort();
    const industryGroupMap = new Map(options.map(o => [o.industry, o.group]));

    // Industries filtered by selected group (or all)
    const effectiveGroup = groupSelect === CUSTOM ? groupCustom : groupSelect;
    const industryOptions = effectiveGroup
        ? options.filter(o => o.group === effectiveGroup).map(o => o.industry).sort()
        : options.map(o => o.industry).sort();

    const handleGroupChange = (val: string) => {
        setGroupSelect(val);
        // clear industry if it no longer belongs to new group
        if (val !== CUSTOM && val) {
            const valid = options.filter(o => o.group === val).map(o => o.industry);
            if (industrySelect !== CUSTOM && !valid.includes(industrySelect)) {
                setIndustrySelect('');
            }
        }
    };

    const handleIndustryChange = (val: string) => {
        setIndustrySelect(val);
        // auto-fill group from mapping
        if (val !== CUSTOM) {
            const mapped = industryGroupMap.get(val);
            if (mapped && groupSelect !== CUSTOM) setGroupSelect(mapped);
        }
    };

    const finalGroup = groupSelect === CUSTOM ? groupCustom.trim() : groupSelect;
    const finalIndustry = industrySelect === CUSTOM ? industryCustom.trim() : industrySelect;

    const hasChanged = finalGroup !== currentGroup || finalIndustry !== currentIndustry;

    const handleSave = async () => {
        if (!finalIndustry) return;
        setSaving(true);
        const result = await updateCompanyIndustryGroup(companyId, finalIndustry, finalGroup);
        setSaving(false);
        if (result.success) {
            toast.success(`Updated — ${result.affected} experience record${result.affected !== 1 ? "s" : ""} synced`);
            onSaved();
            onOpenChange(false);
        } else {
            toast.error(result.error || "Failed to update");
        }
    };

    const selectCls = "w-full h-10 px-3 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white transition-all cursor-pointer";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        Edit Company Classification
                    </DialogTitle>
                    <DialogDescription className="font-semibold text-slate-700 mt-1 truncate" title={companyName}>
                        {companyName}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-1">
                    {/* Group — first */}
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Group</Label>
                        <select value={groupSelect} onChange={e => handleGroupChange(e.target.value)} className={selectCls}>
                            <option value="">— select group —</option>
                            {uniqueGroups.map(g => <option key={g} value={g}>{g}</option>)}
                            <option value={CUSTOM}>✏️ Enter custom...</option>
                        </select>
                        {groupSelect === CUSTOM && (
                            <Input
                                autoFocus
                                value={groupCustom}
                                onChange={e => setGroupCustom(e.target.value)}
                                placeholder="Type custom group name..."
                                className="h-10 mt-1"
                            />
                        )}
                    </div>

                    {/* Industry — second, filtered by group */}
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            Industry
                            {industrySelect !== CUSTOM && industryGroupMap.has(industrySelect) && industrySelect && (
                                <span className="normal-case font-normal tracking-normal text-emerald-500 text-xs">✓ auto-filled group</span>
                            )}
                        </Label>
                        <select value={industrySelect} onChange={e => handleIndustryChange(e.target.value)} className={selectCls}>
                            <option value="">— select industry —</option>
                            {industryOptions.map(i => <option key={i} value={i}>{i}</option>)}
                            <option value={CUSTOM}>✏️ Enter custom...</option>
                        </select>
                        {industrySelect === CUSTOM && (
                            <Input
                                autoFocus
                                value={industryCustom}
                                onChange={e => setIndustryCustom(e.target.value)}
                                placeholder="Type custom industry name..."
                                className="h-10 mt-1"
                            />
                        )}
                        {effectiveGroup && industryOptions.length > 0 && industrySelect !== CUSTOM && (
                            <p className="text-[11px] text-slate-400">
                                Showing {industryOptions.length} industries in "{effectiveGroup}"
                            </p>
                        )}
                    </div>

                    {/* Warning */}
                    {affectedCount !== null && affectedCount > 0 && (
                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700 leading-relaxed">
                                Saving will update <strong>{affectedCount}</strong> experience record{affectedCount !== 1 ? "s" : ""} across the database.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving || !finalIndustry || !hasChanged}>
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
