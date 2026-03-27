"use client";

import React, { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CandidateEditForm } from "@/components/candidate-edit-form";

export default function EditCandidatePage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const resolvedParams = use(params);
    const candidateId = resolvedParams.id;

    const handleSuccess = () => {
        router.replace(`/candidates/${candidateId}`);
        router.refresh();
    };

    const handleCancel = () => {
        router.replace(`/candidates/${candidateId}`);
    };

    return (
        <div className="max-w-4xl mx-auto py-10 px-4">
            <Button 
                variant="ghost" 
                className="gap-2 mb-6 text-muted-foreground hover:text-slate-900" 
                onClick={handleCancel}
            >
                <ArrowLeft className="h-4 w-4" /> Cancel & Back to Profile
            </Button>

            <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-200 p-8">
                <CandidateEditForm 
                    candidateId={candidateId} 
                    onSuccess={handleSuccess}
                    onCancel={handleCancel}
                />
            </div>
        </div>
    );
}
