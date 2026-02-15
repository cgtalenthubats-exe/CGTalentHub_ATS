"use client";

import * as React from "react";
import { Search, Building, Briefcase, User, Command as CommandIcon } from "lucide-react";
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
import { searchCompanies, searchPositions } from "@/app/actions/candidate-filters";
import { useDebounce } from "@/hooks/use-debounce";

interface SmartCandidateSearchProps {
    onSearch: (term: string, type: 'global' | 'company' | 'position') => void;
    onRawQueryChange?: (term: string) => void; // Support live updates
    filters?: any;
    placeholder?: string;
    className?: string;
}

export function SmartCandidateSearch({
    onSearch,
    onRawQueryChange,
    filters,
    placeholder = "Smart Search...",
    className,
}: SmartCandidateSearchProps) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");

    // Suggestions state
    const [companySuggestions, setCompanySuggestions] = React.useState<string[]>([]);
    const [positionSuggestions, setPositionSuggestions] = React.useState<string[]>([]);
    const [loading, setLoading] = React.useState(false);

    // Debounce manual implementation to avoid dependency issues if unsure
    const [debouncedQuery, setDebouncedQuery] = React.useState(query);

    React.useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(query), 300);
        return () => clearTimeout(timer);
    }, [query]);

    React.useEffect(() => {
        if (!debouncedQuery || debouncedQuery.length < 2) {
            setCompanySuggestions([]);
            setPositionSuggestions([]);
            return;
        }

        let active = true;
        setLoading(true);

        const fetchSuggestions = async () => {
            try {
                // Fetch in parallel
                // Pass current filters to scope suggestions!
                const [companies, positions] = await Promise.all([
                    searchCompanies(debouncedQuery, 5, filters),
                    searchPositions(debouncedQuery, 5, filters)
                ]);

                if (active) {
                    setCompanySuggestions(companies);
                    setPositionSuggestions(positions);
                }
            } catch (error) {
                console.error("Error fetching suggestions:", error);
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchSuggestions();

        return () => { active = false; };
    }, [debouncedQuery, filters]);


    const handleSelect = (term: string, type: 'global' | 'company' | 'position') => {
        onSearch(term, type);
        setOpen(false);
        setQuery(""); // Clear input after selection
    };

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
                            <CommandEmpty>No results found.</CommandEmpty>

                            {query.length > 0 && (
                                <>
                                    <CommandGroup heading="Global Search">
                                        <CommandItem onSelect={() => handleSelect(query, 'global')}>
                                            <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                                            <span>Search <strong>"{query}"</strong> in All Fields</span>
                                        </CommandItem>
                                    </CommandGroup>

                                    {companySuggestions.length > 0 && (
                                        <CommandGroup heading="Company">
                                            {companySuggestions.map((company) => (
                                                <CommandItem key={company} onSelect={() => handleSelect(company, 'company')}>
                                                    <Building className="mr-2 h-4 w-4 text-indigo-500" />
                                                    <span>{company}</span>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    )}

                                    {positionSuggestions.length > 0 && (
                                        <CommandGroup heading="Position">
                                            {positionSuggestions.map((position) => (
                                                <CommandItem key={position} onSelect={() => handleSelect(position, 'position')}>
                                                    <Briefcase className="mr-2 h-4 w-4 text-pink-500" />
                                                    <span>{position}</span>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    )}

                                    {/* Fallback Manual Filters if no suggestions or user wants specific filter */}
                                    {companySuggestions.length === 0 && positionSuggestions.length === 0 && (
                                        <CommandGroup heading="Filters">
                                            <CommandItem onSelect={() => handleSelect(query, 'company')}>
                                                <Building className="mr-2 h-4 w-4 text-indigo-500" />
                                                <span>Filter by Company: <strong>"{query}"</strong></span>
                                            </CommandItem>
                                            <CommandItem onSelect={() => handleSelect(query, 'position')}>
                                                <Briefcase className="mr-2 h-4 w-4 text-pink-500" />
                                                <span>Filter by Position: <strong>"{query}"</strong></span>
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
