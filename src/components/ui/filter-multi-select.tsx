"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";

export interface FilterMultiSelectProps {
    label: string;
    icon?: any;
    options: string[];
    selected: string[];
    /** Toggles ONE value on/off. */
    onChange: (value: string) => void;
    /**
     * Replaces the whole selection in one update. When provided the dropdown offers
     * "Select all" for whatever the search currently shows (and a one-shot Clear). Callers that
     * only know how to toggle a single value can omit it — calling onChange in a loop is unsafe
     * for handlers that read stale state or fire a request per call.
     */
    onReplace?: (values: string[]) => void;
    disabled?: boolean;
}

export function FilterMultiSelect({
    label,
    icon: Icon,
    options = [],
    selected,
    onChange,
    onReplace,
    disabled,
}: FilterMultiSelectProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    // If selected is a string (legacy), wrap it. Ideally it should be string[]
    const selectedArray = Array.isArray(selected) ? selected : [];

    // Search is done here (not by cmdk's fuzzy matcher) so "Select all" acts on exactly the rows
    // the user sees. Every typed word must appear somewhere in the option, in any order.
    const visible = useMemo(() => {
        const tokens = search.toLowerCase().split(/\s+/).filter(Boolean);
        if (tokens.length === 0) return options;
        return options.filter(o => {
            const lower = o.toLowerCase();
            return tokens.every(t => lower.includes(t));
        });
    }, [options, search]);

    const allVisibleSelected = visible.length > 0 && visible.every(o => selectedArray.includes(o));

    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        if (!next) setSearch("");
    };

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                        "h-9 gap-2 border-dashed bg-background min-w-[140px] justify-start text-left font-normal",
                        selectedArray.length > 0 && "border-primary/50 bg-primary/5 font-medium"
                    )}
                    disabled={disabled}
                >
                    {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className="truncate">{label}</span>
                    {selectedArray.length > 0 && (
                        <Badge
                            variant="secondary"
                            className="ml-auto h-5 px-1 text-[10px] bg-primary text-primary-foreground shrink-0"
                        >
                            {selectedArray.length}
                        </Badge>
                    )}
                    <ChevronDown className="ml-2 h-3 w-3 opacity-50 shrink-0" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-auto min-w-[240px] max-w-[600px]" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder={`Search ${label}...`}
                        className="h-9"
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandList>
                        {visible.length === 0 && <CommandEmpty>No results found.</CommandEmpty>}
                        {onReplace && visible.length > 0 && (
                            <>
                                <CommandGroup>
                                    <CommandItem
                                        value="__select_all__"
                                        onSelect={() => {
                                            onReplace(
                                                allVisibleSelected
                                                    ? selectedArray.filter(s => !visible.includes(s))
                                                    : [...new Set([...selectedArray, ...visible])]
                                            );
                                        }}
                                        className="font-semibold text-primary"
                                    >
                                        <div
                                            className={cn(
                                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                allVisibleSelected
                                                    ? "bg-primary text-primary-foreground"
                                                    : "opacity-50 [&_svg]:invisible"
                                            )}
                                        >
                                            <Check className="h-4 w-4" />
                                        </div>
                                        {allVisibleSelected
                                            ? `Deselect all${search.trim() ? " matching" : ""} (${visible.length})`
                                            : `Select all${search.trim() ? " matching" : ""} (${visible.length})`}
                                    </CommandItem>
                                </CommandGroup>
                                <CommandSeparator />
                            </>
                        )}
                        <CommandGroup className="max-h-64 overflow-y-auto">
                            {visible.map((option, idx) => {
                                const isSelected = selectedArray.includes(option);
                                return (
                                    <CommandItem
                                        key={`${option}-${idx}`}
                                        value={option}
                                        onSelect={() => onChange(option)}
                                    >
                                        <div
                                            className={cn(
                                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground"
                                                    : "opacity-50 [&_svg]:invisible"
                                            )}
                                        >
                                            <Check className={cn("h-4 w-4")} />
                                        </div>
                                        <span className="whitespace-nowrap pr-4">{option}</span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                        {selectedArray.length > 0 && (
                            <>
                                <CommandSeparator />
                                <CommandGroup>
                                    <CommandItem
                                        onSelect={() => {
                                            if (onReplace) onReplace([]);
                                            else selectedArray.forEach((s) => onChange(s));
                                        }}
                                        className="justify-center text-center text-destructive"
                                    >
                                        Clear filters
                                    </CommandItem>
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
