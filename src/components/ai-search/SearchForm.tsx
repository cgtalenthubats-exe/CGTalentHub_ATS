"use client";

import React, { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitSearch } from "@/app/actions/ai-search";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface SearchFormProps {
    onSearchStart: () => void;
    onSearchComplete: (sessionId: string) => void;
}

export function SearchForm({ onSearchStart, onSearchComplete }: SearchFormProps) {
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        onSearchStart();

        try {
            const res = await submitSearch(query);
            if (res.success && res.sessionId) {
                toast.success("Search started successfully");
                onSearchComplete(res.sessionId);
                setQuery("");
            } else {
                toast.error(res.error || "Failed to start search");
            }
        } catch (error) {
            console.error(error);
            toast.error("An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Search className="w-5 h-5 text-indigo-600" />
                    Search Form
                </CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="relative">
                        <Textarea
                            placeholder="Find CEO, COO or SVP of Food retail business who is Vietnamese..."
                            className="min-h-[120px] resize-none pr-10 text-sm focus-visible:ring-indigo-500"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            disabled={loading}
                        />
                        <div className="absolute bottom-3 right-3">
                            <Button
                                type="submit"
                                size="sm"
                                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                                disabled={loading || !query.trim()}
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                Search
                            </Button>
                        </div>
                    </div>

                    <div className="text-xs text-slate-500 space-y-2 bg-slate-50 p-3 rounded-md">
                        <p className="font-semibold text-slate-700">Search Guidelines & Tips:</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li><span className="font-medium">Listed Companies (SET):</span> Specify the index group like 'SET50' or 'SET100'.</li>
                            <li><span className="font-medium">Hospitality & Hotels:</span> Specify star rating like '4 Star' or '5 Star'.</li>
                            <li>All the process could take 30-40 minutes. Results will be shown as batches.</li>
                        </ul>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
