"use client";

import React, { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Search, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { JobRequisition } from "@/types/requisition";
import { getJobRequisitions } from "@/app/actions/requisitions";

interface JRSwitcherProps {
    selectedId?: string;
    onSelect: (jr: JobRequisition) => void;
}

export function JRSwitcher({ selectedId, onSelect }: JRSwitcherProps) {
    const [open, setOpen] = useState(false);
    const [jrs, setJrs] = useState<JobRequisition[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const data = await getJobRequisitions();
                setJrs(data);
                if (selectedId) {
                    const found = data.find(j => j.id === selectedId);
                    if (found) onSelect(found); // Re-trigger select to ensure parent has full object if needed
                }
            } catch (e) {
                console.error(e);
            }
            setLoading(false);
        }
        load();
    }, []);

    const selectedJR = jrs.find((jr) => jr.id === selectedId);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-[400px] justify-between h-12 text-left"
                >
                    {selectedJR ? (
                        <div className="flex flex-col items-start gap-0.5 overflow-hidden">
                            <span className="font-bold truncate w-full">{selectedJR.job_title}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Badge variant="outline" className="text-[10px] h-4 px-1 py-0">{selectedJR.id}</Badge>
                                <span>{selectedJR.division}</span>
                            </span>
                        </div>
                    ) : (
                        loading ? "Loading Requisitions..." : "Select Job Requisition..."
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0">
                <Command>
                    <CommandInput placeholder="Search by Position, ID, or BU..." />
                    <CommandList>
                        <CommandEmpty>No requisition found.</CommandEmpty>
                        <CommandGroup heading="Active Openings">
                            {jrs.map((jr) => (
                                <CommandItem
                                    key={jr.id}
                                    value={`${jr.id} ${jr.job_title} ${jr.division}`}
                                    onSelect={() => {
                                        onSelect(jr);
                                        setOpen(false);
                                    }}
                                    className="cursor-pointer border-b last:border-0 py-3"
                                >
                                    <div className="flex flex-col w-full gap-1">
                                        <div className="flex justify-between items-center">
                                            <span className="font-semibold">{jr.job_title}</span>
                                            {selectedId === jr.id && <Check className="h-4 w-4 text-primary" />}
                                        </div>
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" /> {jr.division}</span>
                                            <span className="font-mono">{jr.id}</span>
                                        </div>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
