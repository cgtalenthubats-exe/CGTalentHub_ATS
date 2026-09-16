"use client";

import * as React from "react";
import { Search, Building, Briefcase, User, Users, Loader2 } from "lucide-react";
import {
    Command,
    CommandDialog,
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { searchCompanies, searchPositions, searchCandidateNames, type CandidateSuggestion } from "@/app/actions/candidate-filters";

interface SmartCandidateSearchProps {
    onSearch: (term: string, type: 'global' | 'company' | 'position' | 'name') => void;
    onRawQueryChange?: (term: string) => void; // Support live updates
    /**
     * Called when a specific person is picked from the suggestions. Without it the component
     * falls back to a name search, which is the right behaviour where picking a candidate should
     * filter a list rather than navigate away (e.g. the Add-to-JR dialog).
     */
    onSelectCandidate?: (candidate: CandidateSuggestion) => void;
    filters?: any;
    placeholder?: string;
    className?: string;
}

export function SmartCandidateSearch({
    onSearch,
    onRawQueryChange,
    onSelectCandidate,
    filters,
    placeholder = "Smart Search...",
    className,
}: SmartCandidateSearchProps) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");

    // Suggestions state
    const [candidateSuggestions, setCandidateSuggestions] = React.useState<CandidateSuggestion[]>([]);
    const [candidateTotal, setCandidateTotal] = React.useState(0);
    const [companySuggestions, setCompanySuggestions] = React.useState<string[]>([]);
    const [positionSuggestions, setPositionSuggestions] = React.useState<string[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [suggestError, setSuggestError] = React.useState<string | null>(null);
    const requestIdRef = React.useRef(0);

    // Debounce manual implementation to avoid dependency issues if unsure
    const [debouncedQuery, setDebouncedQuery] = React.useState(query);

    React.useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(query), 300);
        return () => clearTimeout(timer);
    }, [query]);

    React.useEffect(() => {
        if (!debouncedQuery || debouncedQuery.length < 2) {
            setCandidateSuggestions([]);
            setCandidateTotal(0);
            setCompanySuggestions([]);
            setPositionSuggestions([]);
            setSuggestError(null);
            // Nothing is in flight — leaving this true would hide the fallback actions forever.
            setLoading(false);
            return;
        }

        // A counter rather than a boolean: a superseded request must be ignored, but it must not
        // be able to leave `loading` stuck on, which is what hid the suggestion list entirely.
        requestIdRef.current += 1;
        const requestId = requestIdRef.current;
        setLoading(true);
        setSuggestError(null);

        const fetchSuggestions = async () => {
            // allSettled, not all: these are three independent lookups, and one failing source
            // used to wipe out the other two — a failure in the position RPC took the candidate
            // and company suggestions down with it, silently.
            const [candidateRes, companyRes, positionRes] = await Promise.allSettled([
                searchCandidateNames(debouncedQuery, 8),
                searchCompanies(debouncedQuery, 5, filters),
                searchPositions(debouncedQuery, 5, filters),
            ]);

            if (requestId !== requestIdRef.current) return;

            // A source can fail two ways: the action rejects (network, server crash), or it
            // returns its own `error` because the query failed. Both have to be visible —
            // an empty dropdown that says nothing is what sent us looking in the wrong place.
            const failures: string[] = [];
            const noteFailure = (label: string, detail: unknown) => {
                console.error(`${label} suggestions failed:`, detail);
                failures.push(label);
            };

            if (candidateRes.status === "fulfilled") {
                setCandidateSuggestions(candidateRes.value.results || []);
                setCandidateTotal(candidateRes.value.totalCount || 0);
                if (candidateRes.value.error) noteFailure("candidates", candidateRes.value.error);
            } else {
                setCandidateSuggestions([]);
                setCandidateTotal(0);
                noteFailure("candidates", candidateRes.reason);
            }

            if (companyRes.status === "fulfilled") {
                setCompanySuggestions(companyRes.value.results || []);
                if ((companyRes.value as any).error) noteFailure("companies", (companyRes.value as any).error);
            } else {
                setCompanySuggestions([]);
                noteFailure("companies", companyRes.reason);
            }

            if (positionRes.status === "fulfilled") {
                setPositionSuggestions(positionRes.value.results || []);
                if ((positionRes.value as any).error) noteFailure("positions", (positionRes.value as any).error);
            } else {
                setPositionSuggestions([]);
                noteFailure("positions", positionRes.reason);
            }

            setSuggestError(failures.length > 0 ? `Couldn't load ${failures.join(", ")}` : null);
            setLoading(false);
        };

        fetchSuggestions();
    }, [debouncedQuery, filters]);

    const handleSelect = (term: string, type: 'global' | 'company' | 'position' | 'name') => {
        onSearch(term, type);
        setOpen(false);
        setQuery(""); // Clear input after selection
    };

    const handleSelectCandidate = (candidate: CandidateSuggestion) => {
        if (onSelectCandidate) {
            onSelectCandidate(candidate);
            setOpen(false);
            setQuery("");
        } else {
            handleSelect(candidate.name, 'name');
        }
    };

    const hasSuggestions =
        candidateSuggestions.length > 0 || companySuggestions.length > 0 || positionSuggestions.length > 0;

    return (
        <div className={cn("relative w-full", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-start text-left font-normal px-3 text-muted-foreground bg-background border-dashed hover:bg-accent/50 hover:text-accent-foreground h-9"
                        onClick={() => setOpen(true)}
                    >
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <span className="truncate">
                            {query || placeholder}
                        </span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[500px] p-0" align="start">
                    <Command shouldFilter={false}>
                        <CommandInput
                            placeholder="Type name, company, or position..."
                            value={query}
                            onValueChange={(val) => {
                                setQuery(val);
                                onRawQueryChange?.(val);
                            }}
                            autoFocus
                        />
                        <CommandList>
                            {/* CommandEmpty only renders when the list has no items at all, and the
                                Global Search row below always exists once something is typed — so a
                                status message placed in here was never visible. Status gets its own
                                row instead. */}
                            <CommandEmpty>Type at least 2 characters</CommandEmpty>

                            {query.length >= 2 && loading && (
                                <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Searching...
                                </div>
                            )}

                            {suggestError && (
                                <div className="px-3 py-2 text-xs text-amber-600">
                                    {suggestError}. The search options below still work.
                                </div>
                            )}

                            {query.length > 0 && (
                                <>
                                    {candidateSuggestions.length > 0 && (
                                        <CommandGroup
                                            heading={
                                                candidateTotal > candidateSuggestions.length
                                                    ? `Candidates — showing ${candidateSuggestions.length} of ${candidateTotal}`
                                                    : `Candidates (${candidateTotal})`
                                            }
                                        >
                                            {candidateSuggestions.map(c => (
                                                <CommandItem
                                                    key={c.candidateId}
                                                    value={`candidate-${c.candidateId}`}
                                                    onSelect={() => handleSelectCandidate(c)}
                                                    className="gap-2"
                                                >
                                                    {c.photo ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={c.photo} alt="" className="h-6 w-6 rounded-full object-cover shrink-0" />
                                                    ) : (
                                                        <span className="h-6 w-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                                            <User className="h-3.5 w-3.5" />
                                                        </span>
                                                    )}
                                                    <span className="flex flex-col min-w-0">
                                                        <span className="truncate font-medium">{c.name}</span>
                                                        <span className="truncate text-[11px] text-muted-foreground">
                                                            {[c.currentPosition, c.currentCompany].filter(Boolean).join(" · ") || c.jobFunction || c.candidateId}
                                                            {c.matchedOn !== "name" && <> — matched on {c.matchedOn}</>}
                                                        </span>
                                                    </span>
                                                </CommandItem>
                                            ))}
                                            {candidateTotal > candidateSuggestions.length && (
                                                <CommandItem
                                                    value="candidates-view-all"
                                                    onSelect={() => handleSelect(query, 'name')}
                                                    className="gap-2 text-muted-foreground"
                                                >
                                                    <span className="h-6 w-6 flex items-center justify-center shrink-0">
                                                        <Users className="h-3.5 w-3.5" />
                                                    </span>
                                                    <span>See all <strong>{candidateTotal}</strong> people matching &quot;{query}&quot;</span>
                                                </CommandItem>
                                            )}
                                        </CommandGroup>
                                    )}

                                    <CommandGroup heading="Global Search">
                                        <CommandItem onSelect={() => handleSelect(query, 'global')}>
                                            <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                                            <span>Search <strong>&quot;{query}&quot;</strong> in All Fields</span>
                                        </CommandItem>
                                    </CommandGroup>

                                    {companySuggestions.length > 0 && (
                                        <CommandGroup heading="Company">
                                            {companySuggestions.map((company, idx) => (
                                                <CommandItem key={`${company}-${idx}`} onSelect={() => handleSelect(company, 'company')}>
                                                    <Building className="mr-2 h-4 w-4 text-indigo-500" />
                                                    <span>{company}</span>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    )}

                                    {positionSuggestions.length > 0 && (
                                        <CommandGroup heading="Position">
                                            {positionSuggestions.map((position, idx) => (
                                                <CommandItem key={`${position}-${idx}`} onSelect={() => handleSelect(position, 'position')}>
                                                    <Briefcase className="mr-2 h-4 w-4 text-pink-500" />
                                                    <span>{position}</span>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    )}

                                    {/* Fallback manual filters. No `!loading` guard: while a lookup is in
                                        flight these are the only usable rows, and a stuck `loading` used to
                                        leave the panel with nothing in it but Global Search. */}
                                    {!hasSuggestions && (
                                        <CommandGroup heading="Filters">
                                            <CommandItem onSelect={() => handleSelect(query, 'name')}>
                                                <User className="mr-2 h-4 w-4 text-emerald-500" />
                                                <span>Filter by Name: <strong>&quot;{query}&quot;</strong></span>
                                            </CommandItem>
                                            <CommandItem onSelect={() => handleSelect(query, 'company')}>
                                                <Building className="mr-2 h-4 w-4 text-indigo-500" />
                                                <span>Filter by Company: <strong>&quot;{query}&quot;</strong></span>
                                            </CommandItem>
                                            <CommandItem onSelect={() => handleSelect(query, 'position')}>
                                                <Briefcase className="mr-2 h-4 w-4 text-pink-500" />
                                                <span>Filter by Position: <strong>&quot;{query}&quot;</strong></span>
                                            </CommandItem>
                                        </CommandGroup>
                                    )}

                                    {/* Always show Filter by Name when there are suggestions too */}
                                    {hasSuggestions && (
                                        <CommandGroup heading="Name Filter">
                                            <CommandItem onSelect={() => handleSelect(query, 'name')}>
                                                <User className="mr-2 h-4 w-4 text-emerald-500" />
                                                <span>Filter by Name only: <strong>&quot;{query}&quot;</strong></span>
                                            </CommandItem>
                                        </CommandGroup>
                                    )}
                                </>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}
