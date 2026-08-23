"use client";

import { useEffect, useState } from "react";
import { Loader2, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusSelect } from "@/components/ui/status-select";
import { ALL_JOB_GROUPING_LABELS, getFunctionsForGrouping } from "@/lib/job-function-constants";

const GENDER_OPTIONS = ['Male', 'Female', 'N/A'];

export function QuickEditBar({ candidate, onSave }: { candidate: any; onSave: (fields: Record<string, any>) => Promise<void> }) {
    const [linkedin, setLinkedin] = useState(candidate?.linkedin || '');
    const [age, setAge] = useState(String(candidate?.age || ''));
    const [gender, setGender] = useState(candidate?.gender || '');
    const [statuses, setStatuses] = useState<string[]>(candidate?.candidate_status || []);
    const [jobGrouping, setJobGrouping] = useState(candidate?.job_grouping || '');
    const [jobFunction, setJobFunction] = useState(candidate?.job_function || '');
    const [saving, setSaving] = useState<string | null>(null);

    useEffect(() => {
        setLinkedin(candidate?.linkedin || '');
        setAge(String(candidate?.age || ''));
        setGender(candidate?.gender || '');
        setStatuses(candidate?.candidate_status || []);
        setJobGrouping(candidate?.job_grouping || '');
        setJobFunction(candidate?.job_function || '');
    }, [candidate]);

    const save = async (field: string, value: any) => {
        setSaving(field);
        await onSave({ [field]: value });
        setSaving(null);
    };

    return (
        <div className="bg-gradient-to-r from-indigo-50/60 to-slate-50/60 rounded-2xl p-5 ring-1 ring-indigo-100/60 space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 flex items-center gap-2">
                <Edit3 className="h-3 w-3" /> Quick Edit
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* LinkedIn */}
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">LinkedIn URL</label>
                    <div className="flex gap-2">
                        <input
                            value={linkedin}
                            onChange={e => setLinkedin(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') save('linkedin', linkedin); }}
                            placeholder="linkedin.com/in/..."
                            className="flex-1 h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        />
                        <Button size="sm" variant="outline" className="h-8 px-3 text-xs font-black"
                            disabled={saving === 'linkedin'}
                            onClick={() => save('linkedin', linkedin)}>
                            {saving === 'linkedin' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                        </Button>
                    </div>
                </div>
                {/* Gender */}
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gender</label>
                    <select
                        value={gender}
                        onChange={e => { setGender(e.target.value); save('gender', e.target.value); }}
                        className="w-full h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    >
                        <option value="">— Select —</option>
                        {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                </div>
                {/* Age */}
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Age (manual override)</label>
                    <div className="flex gap-2">
                        <input
                            type="number"
                            value={age}
                            onChange={e => setAge(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') save('age', parseInt(age) || null); }}
                            placeholder="e.g. 45"
                            className="flex-1 h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        />
                        <Button size="sm" variant="outline" className="h-8 px-3 text-xs font-black"
                            disabled={saving === 'age'}
                            onClick={() => save('age', parseInt(age) || null)}>
                            {saving === 'age' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                        </Button>
                    </div>
                </div>
                {/* Remark / candidate_status */}
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Remark (Status Tags)</label>
                    <div className="flex items-center gap-2">
                        <StatusSelect
                            value={statuses}
                            onChange={(next) => { setStatuses(next); save('candidate_status', next); }}
                            className="h-8 text-xs bg-white"
                            disabled={saving === 'candidate_status'}
                        />
                        {saving === 'candidate_status' && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400 flex-shrink-0" />}
                    </div>
                </div>
                {/* Job Grouping */}
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Job Grouping</label>
                    <select
                        value={jobGrouping}
                        onChange={e => {
                            const v = e.target.value;
                            setJobGrouping(v);
                            setJobFunction('');
                            save('job_grouping', v);
                        }}
                        disabled={saving === 'job_grouping'}
                        className="w-full h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    >
                        <option value="">— Select Grouping —</option>
                        {ALL_JOB_GROUPING_LABELS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                </div>
                {/* Job Function */}
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Job Function</label>
                    <select
                        value={jobFunction}
                        onChange={e => { const v = e.target.value; setJobFunction(v); save('job_function', v); }}
                        disabled={!jobGrouping || saving === 'job_function'}
                        className="w-full h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50"
                    >
                        <option value="">— Select Function —</option>
                        {getFunctionsForGrouping(jobGrouping).map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                </div>
            </div>
        </div>
    );
}
