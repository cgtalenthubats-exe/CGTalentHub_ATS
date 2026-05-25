export interface DemoFilterState {
    position_keywords: string[];
    position_levels: string[];
    industry_group: string | null;
    industries: string[];
    regions: string[];
    countries: string[];
    hotel_ratings: string[];
    hotel_chains: string[];
    current_only: boolean;
    current_and_latest: boolean;
    job_functions: string[];
    positions: string[];
    companies: string[];
    // Exclude filters
    exclude_companies: string[];
    exclude_countries: string[];
    exclude_keywords: string[];
    // Hotel sub-brand (specific brand within a chain)
    hotel_sub_brands: string[];
    // Candidate status
    internal_only: boolean;
    // Profile filters
    genders: string[];
    nationalities: string[];
    age_min: number | null;
    age_max: number | null;
    age_include_unknown: boolean;
    // Position search terms — each term does ilike on position_keyword + position (replaces Keywords dropdown + Position actual)
    position_search: string[];
}

export const EMPTY_FILTERS: DemoFilterState = {
    position_keywords: [],
    position_levels: [],
    industry_group: null,
    industries: [],
    regions: [],
    countries: [],
    hotel_ratings: [],
    hotel_chains: [],
    current_only: false,
    current_and_latest: true,
    job_functions: [],
    positions: [],
    companies: [],
    exclude_companies: [],
    exclude_countries: [],
    exclude_keywords: [],
    hotel_sub_brands: [],
    internal_only: false,
    genders: [],
    nationalities: [],
    age_min: null,
    age_max: null,
    age_include_unknown: true,
    position_search: [],
};

export const POSITION_LEVELS = ["C-Level", "VP", "Director", "Manager", "Supervisor", "Staff"];
export const HOTEL_RATINGS = ["3 Star", "4 Star", "5 Star"];

export type AiSuggestions = Partial<Omit<DemoFilterState, "industry_group" | "current_only" | "current_and_latest" | "positions" | "companies" | "hotel_chains" | "hotel_sub_brands" | "age_min" | "age_max" | "age_include_unknown" | "position_search">>;

export type AiParseResult = {
    filters: Partial<DemoFilterState>;
    suggestions: AiSuggestions;
};

export type CohortAnalysis = {
    top_skills:         { skill: string; count: number }[] | null;
    job_functions:      { function: string; count: number }[] | null;
    languages:          { language: string; count: number }[] | null;
    profiles_with_data: number;
};
