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
import PipelineTab from "./PipelineTab";
import PlacementTab from "./PlacementTab";

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
    const [gpContinents, setGpContinents] = useState<string[]>([]);
    const [gpCountries, setGpCountries] = useState<string[]>([]);
    const [gpIndustries, setGpIndustries] = useState<string[]>([]);
    const [gpGroups, setGpGroups] = useState<string[]>([]);
    const [gpCompanies, setGpCompanies] = useState<string[]>([]);

    // Map View State
    const [mapPosition, setMapPosition] = useState<{ center: [number, number], zoom: number }>(CONTINENT_COORDS["World"]);

    useEffect(() => {
        if (gpContinents.length === 1 && CONTINENT_COORDS[gpContinents[0]]) {
            setMapPosition(CONTINENT_COORDS[gpContinents[0]]);
        } else if (gpContinents.length === 0) {
            setMapPosition(CONTINENT_COORDS["World"]);
        }
    }, [gpContinents]);

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

    // --- Logic: Cascading Options & Filtering (Global Pool) ---
    const { filteredStats, filteredRegionTables, filteredCount, filteredCompaniesCount, availableOptions, mapMarkers } = useMemo(() => {
        if (!globalData || !globalData.rawJobs) return {
            filteredStats: [], filteredRegionTables: {}, filteredCount: 0, filteredCompaniesCount: 0,
            availableOptions: { continents: [], countries: [], industries: [], groups: [], companies: [] },
            mapMarkers: []
        };

        const jobs = globalData.rawJobs;

        // Match Helper
        const matches = (job: any, excludeCategory?: string) => {
            const mContinent = excludeCategory === 'continent' || gpContinents.length === 0 || gpContinents.includes(job.continent);
            const mCountry = excludeCategory === 'country' || gpCountries.length === 0 || gpCountries.includes(job.country);
            const mIndustry = excludeCategory === 'industry' || gpIndustries.length === 0 || gpIndustries.includes(job.industry);
            const mGroup = excludeCategory === 'group' || gpGroups.length === 0 || gpGroups.includes(job.group);
            const mCompany = excludeCategory === 'company' || gpCompanies.length === 0 || gpCompanies.includes(job.company);
            return mContinent && mCountry && mIndustry && mGroup && mCompany;
        };

        // Options
        const optsContinents = new Set<string>();
        const optsCountries = new Set<string>();
        const optsIndustries = new Set<string>();
        const optsGroups = new Set<string>();
        const optsCompanies = new Set<string>();

        jobs.forEach((j: any) => {
            if (matches(j, 'continent')) optsContinents.add(j.continent);
            if (matches(j, 'country')) optsCountries.add(j.country);
            if (matches(j, 'industry') && j.industry) optsIndustries.add(j.industry);
            if (matches(j, 'group') && j.group) optsGroups.add(j.group);
            if (matches(j, 'company')) optsCompanies.add(j.company);
        });

        // Filter
        const finalJobs = jobs.filter((j: any) => matches(j));

        // Re-Aggregate
        const countryAgg: Record<string, number> = {};
        const regionAgg: Record<string, Record<string, number>> = {};
        const uniqueComps = new Set<string>();

        finalJobs.forEach((j: any) => {
            const c = j.country || "Unknown";
            countryAgg[c] = (countryAgg[c] || 0) + 1;
            uniqueComps.add(j.company);

            const cont = j.continent || "Other";
            const uiGroup = cont === "America" ? "South and North America" : cont;

            if (!regionAgg[uiGroup]) regionAgg[uiGroup] = {};
            const compName = j.company || "Unknown";
            regionAgg[uiGroup][compName] = (regionAgg[uiGroup][compName] || 0) + 1;
        });

        const stats = Object.keys(countryAgg).map(c => ({
            country: c,
            continent: globalData.rawJobs.find((j: any) => j.country === c)?.continent || "Other", // Hacky lookup but safe vs filtered
            count: countryAgg[c]
        })).sort((a, b) => b.count - a.count);

        const regionTables: Record<string, any[]> = {};
        Object.keys(regionAgg).forEach(r => {
            const comps = Object.keys(regionAgg[r]).map(c => ({ company: c, count: regionAgg[r][c] }));
            comps.sort((a, b) => b.count - a.count);
            regionTables[r] = comps.slice(0, 50);
        });

        ["Asia", "Europe", "South and North America", "Africa"].forEach(r => {
            if (!regionTables[r]) regionTables[r] = [];
        });

        // Compute Markers
        let markers = [];
        if (gpContinents.length > 0) {
            // Detail View: Show Countries
            markers = stats.map((s: any) => ({
                name: s.country,
                count: s.count,
                coords: getCountryCoords(s.country),
                type: 'country'
            })).filter((m: any) => m.coords);
        } else {
            // Aggregate View: Show Continents
            const agg: Record<string, number> = {};
            stats.forEach((s: any) => {
                const cont = s.continent || "Other";
                const group = cont === "America" ? "South and North America" : cont;
                agg[group] = (agg[group] || 0) + s.count;
            });

            markers = Object.keys(agg).map(k => ({
                name: k,
                count: agg[k],
                coords: CONTINENT_COORDS[k]?.center || [0, 0],
                type: 'continent'
            })).filter(m => m.count > 0 && CONTINENT_COORDS[m.name]);
        }

        return {
            filteredStats: stats,
            filteredRegionTables: regionTables,
            filteredCount: finalJobs.length,
            filteredCompaniesCount: uniqueComps.size,
            availableOptions: {
                continents: Array.from(optsContinents).sort(),
                countries: Array.from(optsCountries).sort(),
                industries: Array.from(optsIndustries).sort(),
                groups: Array.from(optsGroups).sort(),
                companies: Array.from(optsCompanies).sort(),
            },
            mapMarkers: markers
        };

    }, [globalData, gpContinents, gpCountries, gpIndustries, gpGroups, gpCompanies]);



    // --- Logic: Salary Benchmark (Cascading) ---
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
            if (matches(d, 'industry') && d.industry) optsInd.add(d.industry);
            if (matches(d, 'group') && d.group) optsGrp.add(d.group);
            if (matches(d, 'company')) optsComp.add(d.company);
        });

        const filteredDetails = details.filter((d: any) => matches(d));
        const filteredStats = finalStats.filter((s: any) => matches(s));

        return {
            stats: filteredStats,
            details: filteredDetails,
            availableOptions: {
                industries: Array.from(optsInd).sort(),
                groups: Array.from(optsGrp).sort(),
                companies: Array.from(optsComp).sort()
            }
        };

    }, [salaryData, salaryIndustries, salaryGroups, salaryCompanies]);

    // No global loading gate — tabs load independently

    // Scale for Map Bubbles
    const maxCount = Math.max(...(filteredStats.map((s: any) => s.count) || [0]), 10);
    // Adjusted range for cleaner look: smaller bubbles
    const popScale = scaleLinear().domain([0, maxCount]).range([2, 12]);
    const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088FE'];

    return (
        <div className="container mx-auto p-6 space-y-6 bg-background min-h-screen">
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Dashboard</h1>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
                <TabsList className="grid w-full grid-cols-4 max-w-[800px]">
                    <TabsTrigger value="global">Global Candidate Pool</TabsTrigger>
                    <TabsTrigger value="market">Salary Benchmark</TabsTrigger>
                    <TabsTrigger value="pipeline">Recruitment Pipeline</TabsTrigger>
                    <TabsTrigger value="placement">Search &amp; Placement</TabsTrigger>
                </TabsList>

                {/* --- TAB 1: GLOBAL POOL --- */}
                <TabsContent value="global" className="space-y-6">
                    {globalLoading && <div className="flex items-center justify-center h-48"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
                    {!globalLoading && !globalData && <div className="p-8 text-muted-foreground">Failed to load data.</div>}
                    {!globalLoading && globalData && <>
                        {/* Scorecards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <MetricCard title="Candidates" value={filteredCount.toLocaleString()} subtext="Total In Pool" icon={Users} />
                            <MetricCard title="Companies" value={filteredCompaniesCount.toLocaleString()} subtext="Active Companies" icon={TrendingUp} />
                            <MetricCard title="Countries" value={filteredStats.length.toLocaleString()} subtext="Global Reach" icon={Globe} />
                        </div>

                        {/* Filters */}
                        <div className="flex flex-wrap gap-4 items-center">
                            <FilterMultiSelect
                                label="Continent"
                                icon={Globe}
                                options={availableOptions.continents}
                                selected={gpContinents}
                                onChange={(v: string) => toggle(gpContinents, v, setGpContinents)}
                            />
                            <FilterMultiSelect
                                label="Country"
                                icon={MapPin}
                                options={availableOptions.countries}
                                selected={gpCountries}
                                onChange={(v: string) => toggle(gpCountries, v, setGpCountries)}
                            />
                            <FilterMultiSelect
                                label="Industry"
                                icon={TrendingUp}
                                options={availableOptions.industries}
                                selected={gpIndustries}
                                onChange={(v: string) => toggle(gpIndustries, v, setGpIndustries)}
                            />
                            <FilterMultiSelect
                                label="Group"
                                icon={Users}
                                options={availableOptions.groups}
                                selected={gpGroups}
                                onChange={(v: string) => toggle(gpGroups, v, setGpGroups)}
                            />
                            <FilterMultiSelect
                                label="Company"
                                icon={Building}
                                options={availableOptions.companies}
                                selected={gpCompanies}
                                onChange={(v: string) => toggle(gpCompanies, v, setGpCompanies)}
                            />
                            {(gpContinents.length > 0 || gpCountries.length > 0 || gpIndustries.length > 0 || gpGroups.length > 0 || gpCompanies.length > 0) && (
                                <Button variant="ghost" size="sm" onClick={() => {
                                    setGpContinents([]); setGpCountries([]); setGpIndustries([]); setGpGroups([]); setGpCompanies([]);
                                }} className="text-destructive h-9">
                                    Clear
                                </Button>
                            )}
                        </div>


                        <Card className="overflow-hidden border-2 relative">
                            <CardHeader className="bg-muted/30 pb-2 flex flex-row items-center justify-between">
                                <CardTitle>Pool candidate by company and location</CardTitle>
                                {gpContinents.length > 0 && (
                                    <Button size="sm" variant="outline" onClick={() => setGpContinents([])} className="h-8 gap-2">
                                        <RotateCcw className="h-3 w-3" /> Back to World
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent className="h-[600px] p-0 bg-[#E0E2E5] relative transition-all duration-500">
                                <div className="w-full h-full">
                                    <ComposableMap projection="geoMercator" projectionConfig={{ scale: 120 }}>
                                        <ZoomableGroup
                                            center={mapPosition.center}
                                            zoom={mapPosition.zoom}
                                            minZoom={0.5}
                                            maxZoom={10}
                                            onMoveEnd={({ coordinates, zoom }) => {
                                                // Optional: Update state if you want 2-way binding, 
                                                // but strictly controlled is better for drill-down.
                                                // setMapPosition({ center: coordinates as [number, number], zoom });
                                            }}
                                            className="transition-transform duration-700 ease-in-out"
                                        >
                                            <Geographies geography={geoUrl}>
                                                {({ geographies }) =>
                                                    geographies.map((geo) => {
                                                        const isSelectedCountry = gpCountries.includes(geo.properties.name);

                                                        // Highlighting Logic:
                                                        // If Continent View: Highlight nothing or hover continent? (Hard to map geo to continent easily without massive map)
                                                        // If Country View: Highlight selected country

                                                        return (
                                                            <Geography
                                                                key={geo.rsmKey}
                                                                geography={geo}
                                                                onClick={() => {
                                                                    if (gpContinents.length > 0) {
                                                                        toggle(gpCountries, geo.properties.name, setGpCountries);
                                                                    }
                                                                }}
                                                                fill={isSelectedCountry ? "#3b82f6" : "#FFF"}
                                                                stroke={isSelectedCountry ? "#1e40af" : "#D6D6DA"}
                                                                strokeWidth={0.5}
                                                                style={{
                                                                    default: { outline: "none" },
                                                                    hover: { fill: isSelectedCountry ? "#2563eb" : "#F0F0F0", outline: "none" },
                                                                    pressed: { outline: "none" },
                                                                }}
                                                                data-tooltip-id="map-tooltip"
                                                                data-tooltip-content={geo.properties.name}
                                                            />
                                                        );
                                                    })
                                                }
                                            </Geographies>
                                            {mapMarkers.map((m: any, i: number) => {
                                                const isSelected = m.type === 'country' && gpCountries.includes(m.name);
                                                return (
                                                    <Marker
                                                        key={i}
                                                        coordinates={m.coords}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (m.type === 'continent') {
                                                                setGpContinents([m.name]);
                                                                // Effect will handle Zoom
                                                            } else {
                                                                toggle(gpCountries, m.name, setGpCountries);
                                                            }
                                                        }}
                                                        data-tooltip-id="map-tooltip"
                                                        data-tooltip-content={`${m.name}: ${m.count}`}
                                                    >
                                                        <circle
                                                            r={popScale(m.count) + (m.type === 'continent' ? 4 : 0)} // Make continents slightly bigger
                                                            fill={m.type === 'continent' ? "#f97316" : (isSelected ? "#ef4444" : "#0088FE")} // Orange for Continents
                                                            stroke="#FFF"
                                                            strokeWidth={2}
                                                            className="cursor-pointer hover:opacity-80 transition-all duration-300"
                                                        />
                                                        {/* Optional: Add Label for Continents? */}
                                                        {m.type === 'continent' && (
                                                            <text textAnchor="middle" y={5} className="text-[8px] font-bold fill-white pointer-events-none drop-shadow-md">
                                                                {m.count}
                                                            </text>
                                                        )}
                                                    </Marker>
                                                )
                                            })}
                                        </ZoomableGroup>
                                    </ComposableMap>
                                    <ReactTooltip id="map-tooltip" style={{ fontSize: '12px', zIndex: 100 }} />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Regional Tables */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {["Asia", "Europe", "South and North America", "Africa"].map((region) => (
                                <RegionTable key={region} region={region} data={filteredRegionTables[region]} />
                            ))}
                        </div>
                    </>}
                </TabsContent>

                {/* --- TAB 2: SALARY BENCHMARK --- */}
                <TabsContent value="market" className="space-y-6">
                    {salaryLoading && <div className="flex items-center justify-center h-48"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
                    {!salaryLoading && !salaryData && <div className="p-8 text-muted-foreground">Failed to load salary data.</div>}
                    {!salaryLoading && salaryData && <>
                        {/* Filters */}
                        <div className="flex flex-wrap gap-4 items-center">
                            <FilterMultiSelect
                                label="Industry"
                                icon={TrendingUp}
                                options={filteredSalaryData.availableOptions.industries}
                                selected={salaryIndustries}
                                onChange={(v: string) => toggle(salaryIndustries, v, setSalaryIndustries)}
                            />
                            <FilterMultiSelect
                                label="Group"
                                icon={Users}
                                options={filteredSalaryData.availableOptions.groups}
                                selected={salaryGroups}
                                onChange={(v: string) => toggle(salaryGroups, v, setSalaryGroups)}
                            />
                            <FilterMultiSelect
                                label="Company"
                                icon={Building}
                                options={filteredSalaryData.availableOptions.companies}
                                selected={salaryCompanies}
                                onChange={(v: string) => toggle(salaryCompanies, v, setSalaryCompanies)}
                            />
                            {(salaryIndustries.length > 0 || salaryGroups.length > 0 || salaryCompanies.length > 0) && (
                                <Button variant="ghost" size="sm" onClick={() => {
                                    setSalaryIndustries([]); setSalaryGroups([]); setSalaryCompanies([]);
                                }} className="text-destructive h-9">
                                    Clear
                                </Button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[500px]">
                            {/* Bar Chart */}
                            <Card className="h-full flex flex-col">
                                <CardHeader>
                                    <CardTitle>Salary Range per Company</CardTitle>
                                    <CardDescription>Min, Avg, and Max Annual Salary</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1 min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={filteredSalaryData.stats}
                                            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="company" fontSize={10} interval={0} angle={-45} textAnchor="end" />
                                            <YAxis tickFormatter={(val) => `฿${val / 1000}k`} />
                                            <Tooltip formatter={(value: any) => `฿${Number(value || 0).toLocaleString()}`} />
                                            <Legend verticalAlign="top" />
                                            <Bar dataKey="minSalary" fill="#8884d8" name="Min" />
                                            <Bar dataKey="avgSalary" fill="#FFBB28" name="Avg" />
                                            <Bar dataKey="maxSalary" fill="#82ca9d" name="Max" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            {/* Scatter Plot */}
                            <Card className="h-full flex flex-col">
                                <CardHeader>
                                    <CardTitle>Market Position Analysis</CardTitle>
                                    <CardDescription>Max Salary (X) vs Avg Salary (Y)</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1 min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                            <CartesianGrid />
                                            <XAxis type="number" dataKey="maxSalary" name="Max Salary" unit="฿" tickFormatter={(val) => `${val / 1000}k`} />
                                            <YAxis type="number" dataKey="avgSalary" name="Avg Salary" unit="฿" tickFormatter={(val) => `${val / 1000}k`} />
                                            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
                                            <Scatter name="Companies" data={filteredSalaryData.stats} fill="#8884d8">
                                                {filteredSalaryData.stats.map((entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Scatter>
                                        </ScatterChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Detailed Table */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Detailed Salary Breakdown</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="max-h-[500px] overflow-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-[#1e293b] text-white sticky top-0 z-10 shadow-sm">
                                            <tr className="border-b border-gray-700">
                                                <th className="p-3 text-left font-semibold">Industry</th>
                                                <th className="p-3 text-left font-semibold">Company</th>
                                                <th className="p-3 text-left font-semibold">Name</th>
                                                <th className="p-3 text-left font-semibold">Position</th>
                                                <th className="p-3 text-right font-semibold">Base Salary (Mth)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {filteredSalaryData.details.map((s: any, i: number) => (
                                                <tr key={i} className="hover:bg-muted/50 transition-colors">
                                                    <td className="p-3">{s.industry || '-'}</td>
                                                    <td className="p-3">{s.company}</td>
                                                    <td className="p-3">{s.name}</td>
                                                    <td className="p-3 text-muted-foreground">{s.position}</td>
                                                    <td className="p-3 text-right font-mono">฿{s.salaryMonthly.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {filteredSalaryData.details.length === 0 && (
                                        <div className="p-8 text-center text-muted-foreground">No matches found.</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </>}
                </TabsContent>

                {/* --- TAB 3: RECRUITMENT PIPELINE --- */}
                <TabsContent value="pipeline" className="space-y-6">
                    <PipelineTab />
                </TabsContent>

                {/* --- TAB 4: SEARCH & PLACEMENT --- */}
                <TabsContent value="placement" className="space-y-6">
                    <PlacementTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// --- Components ---

function MetricCard({ title, value, subtext, icon: Icon }: any) {
    return (
        <Card className="bg-card shadow-sm border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground mt-1">{subtext}</p>
            </CardContent>
        </Card>
    );
}

function RegionTable({ region, data }: { region: string, data: any[] }) {
    return (
        <Card className="h-[300px] flex flex-col border border-border shadow-sm">
            <CardHeader className="py-2 px-4 bg-muted/40 border-b">
                <CardTitle className="text-sm font-bold uppercase tracking-wider">{region}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0 scrollbar-thin">
                <table className="w-full text-xs">
                    <thead className="bg-[#020817] text-white sticky top-0">
                        <tr>
                            <th className="p-2 text-left w-2/3">Company</th>
                            <th className="p-2 text-right w-1/3">Cand</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {data && data.length > 0 ? (
                            data.map((d, i) => (
                                <tr key={i} className="hover:bg-muted/50">
                                    <td className="p-2 truncate max-w-[150px]" title={d.company}>{d.company}</td>
                                    <td className="p-2 text-right font-medium">{d.count}</td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={2} className="p-4 text-center text-muted-foreground">No Data</td></tr>
                        )}
                    </tbody>
                </table>
            </CardContent>
        </Card>
    );
}

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-popover text-popover-foreground border rounded p-3 shadow-lg text-xs z-50">
                <p className="font-bold text-sm mb-1">{data.company}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span className="text-muted-foreground">Avg:</span>
                    <span className="text-right">฿{data.avgSalary.toLocaleString()}</span>
                    <span className="text-muted-foreground">Max:</span>
                    <span className="text-right">฿{data.maxSalary.toLocaleString()}</span>
                    <span className="text-muted-foreground">Count:</span>
                    <span className="text-right">{data.headcount}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 border-t pt-1 uppercase tracking-wider">{data.industry}</p>
            </div>
        );
    }
    return null;
};

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
