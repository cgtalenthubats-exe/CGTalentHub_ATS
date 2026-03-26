'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Building, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { searchCompanies } from '@/app/actions/candidate-filters'

interface CompanySuggestionInputProps {
    value: string
    onChange: (value: string) => void
    disabled?: boolean
    placeholder?: string
}

export function CompanySuggestionInput({
    value,
    onChange,
    disabled = false,
    placeholder = "Select or type company name..."
}: CompanySuggestionInputProps) {
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState(value)
    const [suggestions, setSuggestions] = React.useState<string[]>([])
    const [totalMatches, setTotalMatches] = React.useState(0)
    const [isLoading, setIsLoading] = React.useState(false)

    // Sync external value to internal query
    React.useEffect(() => {
        setQuery(value)
    }, [value])

    // Fetch suggestions as user types
    React.useEffect(() => {
        if (!open) return // Only fetch when dropdown is open

        const fetchSuggestions = async () => {
            if (query.trim().length < 1) {
                setSuggestions([])
                setTotalMatches(0)
                return
            }

            setIsLoading(true)
            try {
                // Increased limit to 20 per user request
                const response = await searchCompanies(query, 20)
                setSuggestions(response.results || [])
                setTotalMatches(response.totalCount || 0)
            } catch (error) {
                console.error('Error fetching company suggestions:', error)
                setSuggestions([])
                setTotalMatches(0)
            } finally {
                setIsLoading(false)
            }
        }

        const timer = setTimeout(fetchSuggestions, 300)
        return () => clearTimeout(timer)
    }, [query, open])

    const handleSelect = (selectedValue: string) => {
        onChange(selectedValue)
        setQuery(selectedValue)
        setOpen(false)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn(
                        "w-full justify-between font-normal h-10 px-3",
                        !value && "text-muted-foreground"
                    )}
                >
                    <div className="flex items-center gap-2 truncate">
                        <Building size={16} className="text-slate-400 shrink-0" />
                        <span className="truncate">{value || placeholder}</span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Search existing companies..."
                        value={query}
                        onValueChange={(val) => {
                            setQuery(val)
                            onChange(val) // Allow free-text as they type
                        }}
                    />
                    <CommandList>
                        {isLoading && (
                            <div className="p-4 flex items-center justify-center space-x-2 text-xs text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Searching...</span>
                            </div>
                        )}
                        {!isLoading && suggestions.length === 0 && query.trim().length > 0 && (
                            <CommandEmpty className="py-2 text-xs text-center text-muted-foreground">
                                No matching companies found. Using &quot;{query}&quot;
                            </CommandEmpty>
                        )}
                        {suggestions.length > 0 && (
                            <div className="px-3 py-1.5 bg-slate-50 border-b text-[10px] font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center">
                                <span>Found {totalMatches} unique companies</span>
                                {suggestions.length < totalMatches && (
                                    <span className="opacity-70 font-medium lowercase italic">showing top {suggestions.length}</span>
                                )}
                            </div>
                        )}
                        <CommandGroup>
                            {suggestions.map((company) => (
                                <CommandItem
                                    key={company}
                                    value={company}
                                    onSelect={() => handleSelect(company)}
                                    className="text-sm cursor-pointer"
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === company ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {company}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
