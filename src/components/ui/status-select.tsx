"use client";

import * as React from "react";
import { Check, ChevronsUpDown, PlusCircle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getStatuses, addStatus } from "@/app/actions/candidate-filters";
import { toast } from "@/lib/notifications";

interface Status {
    status: string;
    color: string;
}

interface StatusSelectProps {
    value?: string[] | null;
    onChange: (value: string[]) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export function StatusSelect({ value, onChange, placeholder = "Select status...", className, disabled }: StatusSelectProps) {
    const [open, setOpen] = React.useState(false);
    const [statuses, setStatuses] = React.useState<Status[]>([]);
    const [loading, setLoading] = React.useState(false);

    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [newStatusName, setNewStatusName] = React.useState("");
    const [creating, setCreating] = React.useState(false);

    const selected = value ?? [];

    const fetchStatuses = async () => {
        setLoading(true);
        const data = await getStatuses();
        setStatuses(data);
        setLoading(false);
    };

    React.useEffect(() => {
        fetchStatuses();
    }, []);

    const toggle = (status: string) => {
        if (selected.includes(status)) {
            onChange(selected.filter(s => s !== status));
        } else {
            onChange([...selected, status]);
        }
    };

    const handleCreateStatus = async () => {
        if (!newStatusName.trim()) return;

        if (statuses.some(s => s.status.toLowerCase() === newStatusName.trim().toLowerCase())) {
            toast.error("Status already exists");
            return;
        }

        setCreating(true);
        try {
            const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e'];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];

            const res = await addStatus(newStatusName.trim(), randomColor);
            if (res.success) {
                toast.success("Status created");
                await fetchStatuses();
                toggle(newStatusName.trim());
                setDialogOpen(false);
                setNewStatusName("");
            } else {
                toast.error("Failed to create status: " + res.error);
            }
        } catch {
            toast.error("Error creating status");
        } finally {
            setCreating(false);
        }
    };

    const getStatusColor = (statusName: string) => {
        return statuses.find(s => s.status === statusName)?.color;
    };

    return (
        <>
            <div className="space-y-1.5">
                {selected.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {selected.map(s => (
                            <Badge
                                key={s}
                                variant="secondary"
                                className="text-[11px] font-semibold pr-1 gap-1"
                                style={getStatusColor(s) ? { backgroundColor: getStatusColor(s) + '20', color: getStatusColor(s), borderColor: getStatusColor(s) + '40' } : undefined}
                            >
                                {s}
                                <button
                                    type="button"
                                    className="ml-0.5 rounded-full hover:opacity-70"
                                    onClick={() => toggle(s)}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                )}

                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className={cn("w-full justify-between bg-white", className)}
                            disabled={disabled}
                        >
                            <span className="text-muted-foreground">
                                {selected.length === 0 ? placeholder : `${selected.length} selected`}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[220px] p-0" align="start">
                        <Command>
                            <CommandInput placeholder="Search status..." />
                            <CommandList>
                                <CommandEmpty>No status found.</CommandEmpty>
                                <CommandGroup>
                                    <CommandItem
                                        value="none_status_clear"
                                        onSelect={() => {
                                            onChange([]);
                                            setOpen(false);
                                        }}
                                        className="cursor-pointer text-muted-foreground italic"
                                    >
                                        <X className="mr-2 h-4 w-4" />
                                        None (Clear all)
                                    </CommandItem>
                                    {loading && (
                                        <div className="p-4 flex justify-center">
                                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                        </div>
                                    )}
                                    {!loading && statuses.map((status, idx) => (
                                        <CommandItem
                                            key={`${status.status}-${idx}`}
                                            value={status.status}
                                            onSelect={() => toggle(status.status)}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    selected.includes(status.status) ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            <div className="w-2 h-2 rounded-full mr-2 shrink-0" style={{ backgroundColor: status.color }} />
                                            {status.status}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                                <CommandSeparator />
                                <CommandGroup>
                                    <CommandItem
                                        onSelect={() => {
                                            setOpen(false);
                                            setNewStatusName("");
                                            setDialogOpen(true);
                                        }}
                                        className="cursor-pointer text-blue-600 font-medium"
                                    >
                                        <PlusCircle className="mr-2 h-4 w-4" />
                                        Create New Status
                                    </CommandItem>
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Create New Status</DialogTitle>
                        <DialogDescription>
                            Add a new status to the master list. This will be available for all candidates.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Name
                            </Label>
                            <Input
                                id="name"
                                value={newStatusName}
                                onChange={(e) => setNewStatusName(e.target.value)}
                                className="col-span-3"
                                placeholder="e.g. On-Site Interview"
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button type="button" onClick={handleCreateStatus} disabled={!newStatusName.trim() || creating}>
                            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Status
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
