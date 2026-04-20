"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { getGlobalPoolDisplay, getMarketSalaryStats } from "@/app/actions/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import {
    ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
    BarChart, Bar
} from 'recharts';
import { RotateCcw, Loader2, Globe, TrendingUp, Users, Building, MapPin } from "lucide-react";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { Button } from "@/components/ui/button";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { cn } from "@/lib/utils";
import PipelineTab from "./PipelineTab";
import PlacementTab from "./PlacementTab";
import PackageInfoTab from "./PackageInfoTab";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const CONTINENT_COORDS: Record<string, { center: [number, number], zoom: number }> = {
    "Asia": { center: [100, 30], zoom: 3 },
    "Europe": { center: [10, 50], zoom: 4 },
    "South and North America": { center: [-80, 20], zoom: 2.5 },
    "Africa": { center: [20, 0], zoom: 3 },
    "Oceania": { center: [140, -25], zoom: 4 },
    "World": { center: [20, 0], zoom: 1 }
};

export default function DashboardPage() {
    // Data State — loaded lazily per tab
    const [globalData, setGlobalData] = useState<any>(null);
    const [salaryData, setSalaryData] = useState<any>(null);
    const [globalLoading, setGlobalLoading] = useState(false);
    const [salaryLoading, setSalaryLoading] = useState(false);
    const loadedTabs = useRef<Set<string>>(new Set());

    // Active tab
    const [activeTab, setActiveTab] = useState("global");

    // Lazy load per tab — only fetch on first visit
    const loadTab = useCallback(async (tab: string) => {
        if (loadedTabs.current.has(tab)) return;
        loadedTabs.current.add(tab);
        if (tab === "global") {
            setGlobalLoading(true);
            try { setGlobalData(await getGlobalPoolDisplay()); } catch (e) { console.error(e); }
            setGlobalLoading(false);
        } else if (tab === "market") {
            setSalaryLoading(true);
            try { setSalaryData(await getMarketSalaryStats()); } catch (e) { console.error(e); }
            setSalaryLoading(false);
        }
        // pipeline & placement tabs handle their own data internally
    }, []);

    useEffect(() => { loadTab("global"); }, [loadTab]);

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        loadTab(tab);
    };

// Filter State - Global Pool
    const [gpJrNames, setGpJrNames] = useState<string[]>([]);
    const [gpBus, setGpBus] = useState<string[]>([]);
    const [gpSubBus, setGpSubBus] = useState<string[]>([]);
    const [gpTopProfile, setGpTopProfile] = useState<string[]>([]); // "Yes" / "No"
    const [gpGender, setGpGender] = useState<string[]>([]);
    const [gpAgeRange, setGpAgeRange] = useState<[number, number]>([0, 80]);
    const [gpCountries, setGpCountries] = useState<string[]>([]);
    const [gpIndustries, setGpIndustries] = useState<string[]>([]);
    const [gpGroups, setGpGroups] = useState<string[]>([]);
    const [gpCompanies, setGpCompanies] = useState<string[]>([]);
    const [gpRatings, setGpRatings] = useState<string[]>([]);
    const [gpSets, setGpSets] = useState<string[]>([]);

    // Map View State
    const [mapPosition, setMapPosition] = useState<{ center: [number, number], zoom: number }>(CONTINENT_COORDS["World"]);

    // Filter State - Salary Benchmark
    const [salaryIndustries, setSalaryIndustries] = useState<string[]>([]);
    const [salaryGroups, setSalaryGroups] = useState<string[]>([]);
    const [salaryCompanies, setSalaryCompanies] = useState<string[]>([]);

    // --- Helper: Toggle ---
    const toggle = (current: string[], value: string, setter: (val: string[]) => void) => {
        if (current.includes(value)) {
            setter(current.filter(c => c !== value));
        } else {
            setter([...current, value]);
        }
    };

    const resetFilters = () => {
        setGpJrNames([]); setGpBus([]); setGpSubBus([]); setGpTopProfile([]);
        setGpGender([]); setGpAgeRange([0, 80]); setGpCountries([]);
        setGpIndustries([]); setGpGroups([]); setGpCompanies([]);
        setGpRatings([]); setGpSets([]);
    };

    // --- Logic: Cascading Options & Filtering (Global Pool) ---
    const { filteredStats, filteredRegionTables, filteredCount, filteredCompaniesCount, availableOptions, mapMarkers, filteredIndustriesStats } = useMemo(() => {
        if (!globalData || !globalData.rawJobs) return {
            filteredStats: [], filteredRegionTables: {}, filteredCount: 0, filteredCompaniesCount: 0,
            availableOptions: { jr_names: [], bus: [], sub_bus: [], gender: [], ratings: [], sets: [], countries: [], industries: [], groups: [], companies: [] },
            mapMarkers: [], filteredIndustriesStats: []
        };

        const jobs = globalData.rawJobs;

        // Match Helper (Cascading Logic)
        const matches = (job: any, excludeCategory?: string) => {
            const mJr = excludeCategory === 'jr' || gpJrNames.length === 0 || job.jr_names.some((n: string) => gpJrNames.includes(n));
            const mBu = excludeCategory === 'bu' || gpBus.length === 0 || job.bus.some((b: string) => gpBus.includes(b));
            const mSubBu = excludeCategory === 'sub_bu' || gpSubBus.length === 0 || job.sub_bus.some((s: string) => gpSubBus.includes(s));
            const mTop = excludeCategory === 'top' || gpTopProfile.length === 0 || (gpTopProfile.includes("Yes") ? job.is_top_profile : !job.is_top_profile);
            const mGender = excludeCategory === 'gender' || gpGender.length === 0 || gpGender.includes(job.gender);
            const mAge = excludeCategory === 'age' || (job.age >= gpAgeRange[0] && job.age <= gpAgeRange[1]);
            const mCountry = excludeCategory === 'country' || gpCountries.length === 0 || gpCountries.includes(job.country);
            const mIndustry = excludeCategory === 'industry' || gpIndustries.length === 0 || gpIndustries.includes(job.industry);
            const mGroup = excludeCategory === 'group' || gpGroups.length === 0 || gpGroups.includes(job.group);
            const mCompany = excludeCategory === 'company' || gpCompanies.length === 0 || gpCompanies.includes(job.company);
            const mRating = excludeCategory === 'rating' || gpRatings.length === 0 || gpRatings.includes(job.rating.toString());
            const mSet = excludeCategory === 'set' || gpSets.length === 0 || gpSets.includes(job.set);

            return mJr && mBu && mSubBu && mTop && mGender && mAge && mCountry && mIndustry && mGroup && mCompany && mRating && mSet;
        };

        // Options (Dynamic based on other filters)
        const optsJrs = new Set<string>();   const optsBus = new Set<string>();  const optsSubBus = new Set<string>();
        const optsGender = new Set<string>();const optsRatings = new Set<string>(); const optsSets = new Set<string>();
        const optsCountries = new Set<string>(); const optsIndustries = new Set<string>();
        const optsGroups = new Set<string>();  const optsCompanies = new Set<string>();

        jobs.forEach((j: any) => {
            if (matches(j, 'jr')) j.jr_names.forEach((n: string) => optsJrs.add(n));
            if (matches(j, 'bu')) j.bus.forEach((b: string) => optsBus.add(b));
            if (matches(j, 'sub_bu')) j.sub_bus.forEach((s: string) => optsSubBus.add(s));
            if (matches(j, 'gender')) optsGender.add(j.gender);
            if (matches(j, 'rating')) optsRatings.add(j.rating.toString());
            if (matches(j, 'set')) optsSets.add(j.set);
            if (matches(j, 'country')) optsCountries.add(j.country);
            if (matches(j, 'industry')) optsIndustries.add(j.industry);
            if (matches(j, 'group')) optsGroups.add(j.group);
            if (matches(j, 'company')) optsCompanies.add(j.company);
        });

        // Add JRs that might not have candidates yet, but match BU/SubBU filters
        if (globalData.allJRs) {
            globalData.allJRs.forEach((jr: any) => {
                const mBu = gpBus.length === 0 || gpBus.includes(jr.bu);
                const mSubBu = gpSubBus.length === 0 || gpSubBus.includes(jr.sub_bu);
                if (mBu && mSubBu) optsJrs.add(jr.jr_name);
            });
        }

        // Final Filtered List
        const finalJobs = jobs.filter((j: any) => matches(j));

        // Aggregate for Display
        const countryAgg: Record<string, number> = {};
        const companyTopProfileMap: Record<string, boolean> = {}; // Track if company has any top profile in filtered set
        const industryAgg: Record<string, number> = {};
        const regionAgg: Record<string, Array<{ country: string, company: string, count: number, hasTop: boolean }>> = {};
        const uniqueComps = new Set<string>();

        finalJobs.forEach((j: any) => {
            countryAgg[j.country] = (countryAgg[j.country] || 0) + 1;
            industryAgg[j.industry] = (industryAgg[j.industry] || 0) + 1;
            uniqueComps.add(j.company);
            if (j.is_top_profile) companyTopProfileMap[j.company] = true;

            const cont = j.continent || "Other";
            if (!regionAgg[cont]) regionAgg[cont] = [];
            
            let entry = regionAgg[cont].find(e => e.country === j.country && e.company === j.company);
            if (!entry) {
                entry = { country: j.country, company: j.company, count: 0, hasTop: false };
                regionAgg[cont].push(entry);
            }
            entry.count++;
            if (j.is_top_profile) entry.hasTop = true;
        });

        // Sort Region data: 1. Top Profiles First, 2. Alphabetical A-Z
        Object.keys(regionAgg).forEach(cont => {
            regionAgg[cont].sort((a, b) => {
                if (a.hasTop && !b.hasTop) return -1;
                if (!a.hasTop && b.hasTop) return 1;
                return a.company.localeCompare(b.company);
            });
        });

        const industryStats = Object.keys(industryAgg).map(ind => ({ name: ind, count: industryAgg[ind] })).sort((a, b) => b.count - a.count);

        return {
            filteredStats: Object.keys(countryAgg).map(c => ({ country: c, count: countryAgg[c] })),
            filteredRegionTables: regionAgg,
            filteredCount: finalJobs.length,
            filteredCompaniesCount: uniqueComps.size,
            filteredIndustriesStats: industryStats,
            availableOptions: {
                jr_names: Array.from(optsJrs).sort(),
                bus: Array.from(optsBus).sort(),
                sub_bus: Array.from(optsSubBus).sort(),
                gender: Array.from(optsGender).sort(),
                ratings: Array.from(optsRatings).sort(),
                sets: Array.from(optsSets).sort(),
                countries: Array.from(optsCountries).sort(),
                industries: Array.from(optsIndustries).sort(),
                groups: Array.from(optsGroups).sort(),
                companies: Array.from(optsCompanies).sort(),
            },
            mapMarkers: Object.keys(countryAgg).map(c => ({
                name: c,
                count: countryAgg[c],
                coords: getCountryCoords(c)
            })).filter(m => m.coords)
        };
    }, [globalData, gpJrNames, gpBus, gpSubBus, gpTopProfile, gpGender, gpAgeRange, gpCountries, gpIndustries, gpGroups, gpCompanies, gpRatings, gpSets]);

    // --- Logic: Salary Benchmark Filtering ---
    const filteredSalaryData = useMemo(() => {
        if (!salaryData) return { stats: [], details: [], availableOptions: { industries: [], groups: [], companies: [] } };

        const details = salaryData.details;
        const finalStats = salaryData.companyStats;

        const matches = (item: any, exclude?: string) => {
            const mInd = exclude === 'industry' || salaryIndustries.length === 0 || salaryIndustries.includes(item.industry);
            const mGrp = exclude === 'group' || salaryGroups.length === 0 || salaryGroups.includes(item.group);
            const mComp = exclude === 'company' || salaryCompanies.length === 0 || salaryCompanies.includes(item.company);
            return mInd && mGrp && mComp;
        };

        const optsInd = new Set<string>();
        const optsGrp = new Set<string>();
        const optsComp = new Set<string>();

        details.forEach((d: any) => {
            if (matches(d, 'industry')) optsInd.add(d.industry);
            if (matches(d, 'group')) optsGrp.add(d.group);
            if (matches(d, 'company')) optsComp.add(d.company);
        });

        return {
            stats: finalStats.filter((s: any) => matches(s)),
            details: details.filter((d: any) => matches(d)),
            availableOptions: {
                industries: Array.from(optsInd).sort(),
                groups: Array.from(optsGrp).sort(),
                companies: Array.from(optsComp).sort()
            }
        };
    }, [salaryData, salaryIndustries, salaryGroups, salaryCompanies]);

    // Scales for Map
    const maxCount = Math.max(...(filteredStats.map((s: any) => s.count) || [0]), 10);
    const popScale = scaleLinear().domain([0, maxCount]).range([3, 15]);

    return (
        <div className="container mx-auto p-4 space-y-6 bg-[#F8FAFC] min-h-screen max-w-[1600px]">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <h1 className="text-2xl font-black tracking-tight text-slate-800 uppercase italic">Pool candidates by company & location</h1>
                <div className="font-black text-slate-400 tracking-widest text-lg">CENTRALGROUP</div>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
                <TabsList className="bg-slate-100 p-1 rounded-lg">
                    <TabsTrigger value="global" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Global Candidate Pool</TabsTrigger>
                    <TabsTrigger value="market" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Salary Benchmark</TabsTrigger>
                    <TabsTrigger value="pipeline" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Recruitment Pipeline</TabsTrigger>
                    <TabsTrigger value="placement" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Search & Placement</TabsTrigger>
                    <TabsTrigger value="package" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Package Info</TabsTrigger>
                </TabsList>

                <TabsContent value="global" className="space-y-6 outline-none relative min-h-[400px]">
                    {globalLoading && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-[2px] rounded-3xl">
                            <div className="flex flex-col items-center gap-3 p-8 bg-white shadow-2xl rounded-3xl border border-slate-100 scale-110 animate-in fade-in zoom-in duration-300">
                                <Loader2 className="h-12 w-12 text-red-600 animate-spin" />
                                <div className="flex flex-col items-center">
                                    <span className="text-sm font-black uppercase tracking-widest text-slate-800">Processing Data</span>
                                    <span className="text-[10px] font-bold text-slate-400">Fetching 7,134 candidate profiles...</span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* LEFT AREA: MAP & TABLES */}
                        <div className="flex-1 space-y-6">
                            {/* TOP FILTERS */}
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
                                <FilterMultiSelect label="JR Name" options={availableOptions.jr_names} selected={gpJrNames} onChange={v => toggle(gpJrNames, v, setGpJrNames)} />
                                <FilterMultiSelect label="BU" options={availableOptions.bus} selected={gpBus} onChange={v => toggle(gpBus, v, setGpBus)} />
                                <FilterMultiSelect label="Sub BU" options={availableOptions.sub_bus} selected={gpSubBus} onChange={v => toggle(gpSubBus, v, setGpSubBus)} />
                                <FilterMultiSelect label="Top Profile" options={["Yes", "No"]} selected={gpTopProfile} onChange={v => toggle(gpTopProfile, v, setGpTopProfile)} />
                                <FilterMultiSelect label="Gender" options={availableOptions.gender} selected={gpGender} onChange={v => toggle(gpGender, v, setGpGender)} />
                                
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500">Age {gpAgeRange[0]}-{gpAgeRange[1]}</label>
                                    <div className="flex items-center gap-2">
                                        <input type="range" min="0" max="80" value={gpAgeRange[1]} onChange={e => setGpAgeRange([gpAgeRange[0], parseInt(e.target.value)])} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600" />
                                    </div>
                                </div>

                                <Button variant="destructive" size="icon" onClick={resetFilters} className="bg-red-700 hover:bg-red-800 rounded-xl shadow-lg border-2 border-white">
                                    <RotateCcw className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* SECONDARY FILTERS */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                <FilterMultiSelect label="Country" options={availableOptions.countries} selected={gpCountries} onChange={v => toggle(gpCountries, v, setGpCountries)} />
                                <FilterMultiSelect label="Industry" options={availableOptions.industries} selected={gpIndustries} onChange={v => toggle(gpIndustries, v, setGpIndustries)} />
                                <FilterMultiSelect label="Group" options={availableOptions.groups} selected={gpGroups} onChange={v => toggle(gpGroups, v, setGpGroups)} />
                                <FilterMultiSelect label="Company" options={availableOptions.companies} selected={gpCompanies} onChange={v => toggle(gpCompanies, v, setGpCompanies)} />
                                <FilterMultiSelect label="Rating" options={availableOptions.ratings} selected={gpRatings} onChange={v => toggle(gpRatings, v, setGpRatings)} />
                                <FilterMultiSelect label="Set" options={availableOptions.sets} selected={gpSets} onChange={v => toggle(gpSets, v, setGpSets)} />
                            </div>

                            {/* MAP */}
                            <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white/50 backdrop-blur-sm">
                                <CardContent className="h-[550px] p-0 relative">
                                    <ComposableMap projection="geoMercator" projectionConfig={{ scale: 120 }}>
                                        <ZoomableGroup center={[20, 10]} zoom={1.2}>
                                            <Geographies geography={geoUrl}>
                                                {({ geographies }) => geographies.map((geo) => (
                                                    <Geography 
                                                        key={geo.rsmKey} 
                                                        geography={geo} 
                                                        fill="#F1F5F9" 
                                                        stroke="#CBD5E1" 
                                                        strokeWidth={0.5} 
                                                        style={{ default: { outline: "none" }, hover: { fill: "#E2E8F0", outline: "none" } }}
                                                    />
                                                ))}
                                            </Geographies>
                                            {mapMarkers.map((m: any, i: number) => (
                                                <Marker key={i} coordinates={m.coords}>
                                                    <circle 
                                                        r={popScale(m.count)} 
                                                        fill="#1E293B" 
                                                        fillOpacity={0.7} 
                                                        stroke="#475569" 
                                                        strokeWidth={1} 
                                                        className="hover:fill-blue-600 transition-colors cursor-pointer" 
                                                        data-tooltip-id="global-tooltip" 
                                                        data-tooltip-content={`${m.name}: ${m.count} Candidates`}
                                                    />
                                                    <text y={-10} textAnchor="middle" className="text-[6px] font-black uppercase fill-slate-700 pointer-events-none">{m.name}</text>
                                                </Marker>
                                            ))}
                                        </ZoomableGroup>
                                    </ComposableMap>
                                    
                                    {/* Additional Metadata overlay buttons (if needed) */}
                                    <div className="absolute top-4 right-4 flex flex-col gap-2">
                                        <div className="bg-white/80 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-white flex flex-col items-end">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Intelligence</span>
                                            <div className="text-xs font-bold text-slate-600">Active Monitoring</div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Regional Split Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                                {["Africa", "Asia", "Europe", "America", "Oceania", "Other"].map(cont => (
                                    <ContinentCard 
                                        key={cont} 
                                        continent={cont === "America" ? "North & South America" : cont} 
                                        data={filteredRegionTables[cont]} 
                                    />
                                ))}
                            </div>
                        </div>

                        {/* RIGHT AREA: SCORECARDS & INDUSTRY LIST */}
                        <div className="w-full lg:w-72 space-y-4">
                            <MetricBox title="Candidate" value={filteredCount.toLocaleString()} color="bg-slate-900" />
                            <MetricBox title="Company" value={filteredCompaniesCount.toLocaleString()} color="bg-blue-900" />
                            <MetricBox title="Country" value={filteredStats.length.toLocaleString()} color="bg-slate-800" />

                            <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white h-[calc(100%-350px)]">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500">Industry</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0 overflow-auto h-full scrollbar-thin">
                                    <div className="flex flex-col">
                                        {filteredIndustriesStats.map((ind: any) => (
                                            <div key={ind.name} className="flex justify-between items-center p-3 hover:bg-slate-50 transition-colors border-b border-slate-50 group">
                                                <span className="text-[11px] font-bold text-slate-600 truncate mr-2" title={ind.name}>{ind.name}</span>
                                                <span className="text-[10px] font-black bg-slate-100 px-2 py-0.5 rounded-full group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">{ind.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* --- TAB 2: SALARY BENCHMARK --- */}
                <TabsContent value="market" className="relative min-h-[400px] outline-none">
                    {salaryLoading && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-[2px] rounded-3xl">
                            <div className="flex flex-col items-center gap-3 p-8 bg-white shadow-2xl rounded-3xl border border-slate-100 scale-110 animate-in fade-in zoom-in duration-300">
                                <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
                                <div className="flex flex-col items-center">
                                    <span className="text-sm font-black uppercase tracking-widest text-slate-800">Analyzing Market</span>
                                    <span className="text-[10px] font-bold text-slate-400">Processing salary benchmarks...</span>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div className="space-y-6">
                        {/* Filters */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <FilterMultiSelect label="Industry" options={availableOptions.industries} selected={salaryIndustries} onChange={v => toggle(salaryIndustries, v, setSalaryIndustries)} />
                            <FilterMultiSelect label="Group" options={availableOptions.groups} selected={salaryGroups} onChange={v => toggle(salaryGroups, v, setSalaryGroups)} />
                            <FilterMultiSelect label="Company" options={availableOptions.companies} selected={salaryCompanies} onChange={v => toggle(salaryCompanies, v, setSalaryCompanies)} />
                            <div className="flex items-end">
                                <Button variant="outline" onClick={() => { setSalaryIndustries([]); setSalaryGroups([]); setSalaryCompanies([]); }} className="rounded-xl gap-2 w-full">
                                    <RotateCcw className="h-4 w-4" /> Reset Filters
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* Scatter Chart */}
                            <Card className="lg:col-span-12 border-none shadow-xl rounded-3xl overflow-hidden bg-white">
                                <CardHeader>
                                    <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">Market Salary Distribution (Annual)</CardTitle>
                                    <CardDescription>Average vs Max salaries by company</CardDescription>
                                </CardHeader>
                                <CardContent className="h-[400px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis type="number" dataKey="avgSalary" name="Avg Salary" unit="฿" tickFormatter={(v) => `฿${(v/1000).toFixed(0)}k`} fontSize={10} axisLine={false} tickLine={false} />
                                            <YAxis type="number" dataKey="maxSalary" name="Max Salary" unit="฿" tickFormatter={(v) => `฿${(v/1000).toFixed(0)}k`} fontSize={10} axisLine={false} tickLine={false} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Scatter name="Companies" data={filteredSalaryData.stats} fill="#3b82f6">
                                                {filteredSalaryData.stats.map((entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={entry.avgSalary > 5000000 ? '#ef4444' : '#3b82f6'} />
                                                ))}
                                            </Scatter>
                                        </ScatterChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            {/* Detailed List */}
                            <Card className="lg:col-span-12 border-none shadow-xl rounded-3xl overflow-hidden bg-white">
                                <CardHeader>
                                    <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">Detailed Salary Breakdown</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="max-h-[500px] overflow-auto scrollbar-thin">
                                        <table className="w-full text-xs">
                                            <thead className="bg-slate-900 text-white sticky top-0 z-10 shadow-sm">
                                                <tr>
                                                    <th className="p-4 text-left font-black uppercase tracking-widest">Industry</th>
                                                    <th className="p-4 text-left font-black uppercase tracking-widest">Company</th>
                                                    <th className="p-4 text-left font-black uppercase tracking-widest">Name</th>
                                                    <th className="p-4 text-left font-black uppercase tracking-widest">Position</th>
                                                    <th className="p-4 text-right font-black uppercase tracking-widest">Base Salary (Mth)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {filteredSalaryData.details.map((s: any, i: number) => (
                                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                        <td className="p-4 font-bold text-slate-400">{s.industry || '-'}</td>
                                                        <td className="p-4 font-black text-slate-800">{s.company}</td>
                                                        <td className="p-4 font-bold text-slate-600">{s.name}</td>
                                                        <td className="p-4 text-slate-500">{s.position}</td>
                                                        <td className="p-4 text-right font-black text-blue-600">฿{s.salaryMonthly.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {filteredSalaryData.details.length === 0 && (
                                            <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest">No matching salary data found</div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* --- TAB 3: RECRUITMENT PIPELINE --- */}
                <TabsContent value="pipeline" className="space-y-6 outline-none">
                    <PipelineTab />
                </TabsContent>

                {/* --- TAB 4: SEARCH & PLACEMENT --- */}
                <TabsContent value="placement" className="space-y-6 outline-none">
                    <PlacementTab />
                </TabsContent>

                {/* --- TAB 5: PACKAGE INFO --- */}
                <TabsContent value="package" className="space-y-6 outline-none">
                    <PackageInfoTab />
                </TabsContent>
            </Tabs>
            <ReactTooltip id="global-tooltip" style={{ borderRadius: '12px', fontWeight: 'bold' }} />
        </div>
    );
}

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-slate-900 text-white border-none rounded-2xl p-4 shadow-2xl text-[10px] z-50">
                <p className="font-black text-xs mb-2 uppercase tracking-widest border-b border-slate-700 pb-2">{data.company}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span className="text-slate-400 uppercase font-black">Avg:</span>
                    <span className="text-right font-black text-blue-400">฿{data.avgSalary.toLocaleString()}</span>
                    <span className="text-slate-400 uppercase font-black">Max:</span>
                    <span className="text-right font-black text-red-400">฿{data.maxSalary.toLocaleString()}</span>
                    <span className="text-slate-400 uppercase font-black">Count:</span>
                    <span className="text-right font-black">{data.headcount}</span>
                </div>
                <p className="text-[8px] text-slate-500 mt-3 uppercase tracking-[0.2em]">{data.industry}</p>
            </div>
        );
    }
    return null;
};

function MetricBox({ title, value, color }: any) {
    return (
        <div className={cn("p-6 rounded-3xl shadow-2xl flex flex-col items-center justify-center text-white gap-1", color)}>
            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{title}</span>
            <span className="text-4xl font-black">{value}</span>
        </div>
    );
}

function ContinentCard({ continent, data }: { continent: string, data: any[] }) {
    const totalCount = data?.reduce((acc, curr) => acc + curr.count, 0) || 0;
    
    return (
        <Card className="border-none shadow-xl rounded-3xl overflow-hidden flex flex-col h-[350px] bg-white">
            <CardHeader className="py-3 px-4 flex flex-row justify-between items-center bg-slate-50/50">
                <CardTitle className="text-[13px] font-black uppercase tracking-tight text-slate-800">{continent}</CardTitle>
                <div className="bg-slate-900 text-white text-[11px] font-black px-2 py-1 rounded-lg shadow-md min-w-[28px] text-center">
                    {totalCount}
                </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto scrollbar-thin">
                <table className="w-full text-[10px] border-collapse">
                    <thead className="bg-slate-100/50 sticky top-0 z-10">
                        <tr>
                            <th className="p-2 text-left font-black uppercase text-slate-400 w-1/3">Country</th>
                            <th className="p-2 text-left font-black uppercase text-slate-400">Company</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {data?.map((d, i) => (
                            <tr key={i} className={cn("hover:bg-slate-50 transition-colors", d.hasTop && "bg-emerald-50/50")}>
                                <td className="p-2 font-bold text-slate-500 uppercase tracking-tighter truncate max-w-[60px]" title={d.country}>{d.country}</td>
                                <td className={cn("p-2 font-bold truncate max-w-[100px]", d.hasTop && "text-emerald-700 font-black")}>
                                    {d.company}
                                    {d.hasTop && <span className="ml-1 text-[8px] bg-emerald-500 text-white px-1 rounded-sm">TOP</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </CardContent>
        </Card>
    );
}

// Helper: Mock Coords for key countries (Expanded)
function getCountryCoords(countryName: string): [number, number] | null {
    const map: Record<string, [number, number]> = {
        "Thailand": [100.9925, 15.8700],
        "United States": [-95.7129, 37.0902],
        "China": [104.1954, 35.8617],
        "Japan": [138.2529, 36.2048],
        "Germany": [10.4515, 51.1657],
        "United Kingdom": [-3.4360, 55.3781],
        "Singapore": [103.8198, 1.3521],
        "Vietnam": [108.2772, 14.0583],
        "India": [78.9629, 20.5937],
        "Australia": [133.7751, -25.2744],
        "France": [2.2137, 46.2276],
        "Italy": [12.5674, 41.8719],
        "Canada": [-106.3468, 56.1304],
        "Brazil": [-51.9253, -14.2350],
        "Russia": [105.3188, 61.5240],
        "South Korea": [127.7669, 35.9078],
        "Spain": [-3.7492, 40.4637],
        "Mexico": [-102.5528, 23.6345],
        "Indonesia": [113.9213, -0.7893],
        "Malaysia": [101.9758, 4.2105],
        "Philippines": [121.7740, 12.8797],
        "Taiwan": [120.9605, 23.6978],
        "Hong Kong": [114.1694, 22.3193],
        "Netherlands": [5.2913, 52.1326],
        "Switzerland": [8.2275, 46.8182],
        "Sweden": [18.6435, 60.1282],
        "Belgium": [4.4699, 50.5039],
        "Austria": [14.5501, 47.5162],
        "Turkey": [35.2433, 38.9637],
        "United Arab Emirates": [53.8478, 23.4241],
        "South Africa": [22.9375, -30.5595],
        "New Zealand": [174.8860, -40.9006],
        "Egypt": [30.8025, 26.8206],
        "Saudi Arabia": [45.0792, 23.8859],
        "Argentina": [-63.6167, -38.4161],
        "Chile": [-71.5430, -35.6751],
        "Colombia": [-74.2973, 4.5709],
        "Peru": [-75.0152, -9.1900],
        "Poland": [19.1451, 51.9194],
        "Ireland": [-8.2439, 53.4129],
        "Norway": [8.4689, 60.4720],
        "Finland": [25.7482, 61.9241],
        "Denmark": [9.5018, 56.2639],
        "Portugal": [-8.2245, 39.3999]
    };
    return map[countryName] || map[Object.keys(map).find(k => k.includes(countryName) || countryName.includes(k)) || ""] || null;
}
