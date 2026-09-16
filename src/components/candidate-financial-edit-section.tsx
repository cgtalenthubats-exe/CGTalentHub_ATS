"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompensationSummary } from "@/components/compensation-summary";
import { CompensationFieldsGrid } from "@/components/compensation-fields-grid";
import { buildCompensationPayload, readCompensation, type CompensationDraft } from "@/lib/compensation";

/**
 * Compensation block inside the candidate sheets — read-only until you hit Edit.
 *
 * Both the display and the inputs come from COMPENSATION_FIELDS, so this no longer keeps its own
 * copy of the field list (it used to, and had already fallen out of step with the main edit form).
 */
export function FinancialEditSection({ candidate, onSave }: { candidate: any; onSave: (fields: Record<string, any>) => Promise<void> }) {
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [draft, setDraft] = useState<CompensationDraft>({ values: {}, provided: {} });

    useEffect(() => {
        setDraft(readCompensation(candidate));
    }, [candidate]);

    const handleSave = async () => {
        setSaving(true);
        await onSave(buildCompensationPayload(draft));
        setSaving(false);
        setEditing(false);
    };

    const handleCancel = () => {
        setDraft(readCompensation(candidate));
        setEditing(false);
    };

    return (
        <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                Financial Profile &amp; Benefits
                <button
                    onClick={() => (editing ? handleCancel() : setEditing(true))}
                    className="ml-auto text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                >
                    {editing ? "Cancel" : "Edit"}
                </button>
            </h3>

            <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100/50">
                {editing ? (
                    <>
                        <CompensationFieldsGrid draft={draft} onChange={setDraft} />
                        <div className="mt-5 flex justify-end">
                            <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 px-5 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white">
                                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save Changes"}
                            </Button>
                        </div>
                    </>
                ) : (
                    <CompensationSummary candidate={candidate} />
                )}
            </div>
        </div>
    );
}
