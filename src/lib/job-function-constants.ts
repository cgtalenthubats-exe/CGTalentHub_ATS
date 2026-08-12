export interface JobGrouping {
    label: string;
    functions: string[];
}

export const JOB_GROUPINGS: JobGrouping[] = [
    { label: "Sustainability (SS)", functions: ["Sustainability (A)", "CSV/CSR (B)"] },
    {
        label: "Human Resources (HR)", functions: [
            "Human Resources (A)", "HR Business Partner (B)", "Organization Development (C)",
            "HR Development (D)", "HR Shared Service (E)", "Total Reward (F)",
            "HR Communication and Engagement (G)", "Recruitment/Talent Acquisition (H)"
        ]
    },
    {
        label: "Finance (FA)", functions: [
            "Finance (A)", "Accounting (B)", "Merger & Acquisition and Investment (C)",
            "Investor Relations (D)", "Financial Planning & Analysis (E)",
            "F&A Operations (F)", "F&A Reporting (G)", "Treasury (H)"
        ]
    },
    { label: "Internal Audit (IA)", functions: ["Internal Audit (A)", "Process & Ops Audit (B)", "Stock Count (C)"] },
    {
        label: "Professional Services (PS)", functions: [
            "Professional Services (A)", "Project Management and Performance Management (B)",
            "Insurance/Broker (E)", "Business Process Improvement (F)"
        ]
    },
    { label: "Strategy (SP)", functions: ["Corporate Strategy (A)", "Functional Strategy (C)"] },
    {
        label: "Risk Mgmt. Legal & Compliance (LC)", functions: [
            "Risk Mgmt. Legal & Compliance (A)", "Legal (C)", "Compliance (D)", "Risk Management (E)"
        ]
    },
    {
        label: "General Affairs (GA)", functions: [
            "General Affairs (A)", "Secretary (B)", "Government/Corporate Affairs (C)",
            "General Administrative (D)", "Driver/Messenger/Housekeeper (E)",
            "Executive Assistant/Personal Assistant (F)"
        ]
    },
    {
        label: "Health Safety and Environment (LP)", functions: [
            "Health Safety and Environment (SHE) (A)", "Loss Prevention (B)", "Safety (C)"
        ]
    },
    {
        label: "Business Intelligence & Analytics (BI)", functions: [
            "Business Intelligence & Analytics (A)", "Business Intelligence (B)", "Analytics (C)"
        ]
    },
    {
        label: "Supply Chain and Logistics Mgmt. (LD)", functions: [
            "Supply Chain and Logistics Mgmt. (A)", "Replenishment (B)", "Warehouse Management (C)",
            "Transportation and Logistics (D)", "Non-Merchandising Procurement (E)",
            "Import-Export (F)", "Goods Receiving (G)", "Supply Chain Management (H)", "Inventory Management (I)"
        ]
    },
    { label: "Customer Service (CS)", functions: ["Customer Service (A)", "Call/Contact Center (B)", "Parking Service (C)"] },
    { label: "Quality Assurance (QA)", functions: ["Quality Assurance (A)", "Food Safety (B)", "Quality Management (C)"] },
    { label: "Production (PR)", functions: ["Production (A)", "Production Planning (B)"] },
    {
        label: "Digital & Information Technology (IT)", functions: [
            "Digital and Information Technology (A)", "Technology and Application Development (B)",
            "IT Infrastructure (C)", "IT Services (D)", "Product Owner/Manager (E)",
            "IT Security Risk Compliance (F)", "UX/UI (G)", "Innovation (H)", "Data Science/Analytics (I)"
        ]
    },
    { label: "Property Development (PD)", functions: ["Property Development (A)", "Land & Site Acquisition (B)"] },
    { label: "Store Development (SD)", functions: ["Store Development (A)", "Store Concept & Design (B)"] },
    {
        label: "Property Mgmt. (PM)", functions: [
            "Property Management (A)", "Residential Property Mgmt. (B)", "Tenant Relation (C)"
        ]
    },
    {
        label: "Engineering & Maintenance (EA)", functions: [
            "Engineering & Maintenance (A)", "Engineering (B)", "Maintenance Technician (D)",
            "Service & Installation Technician (E)", "Technical Specialist (F)"
        ]
    },
    {
        label: "Hospitality (HL)", functions: [
            "Hospitality (A)", "Hotel Operations Management (B)", "Front/Concierge (C)",
            "Entertainment & Recreation (D)", "Esthetics (E)", "Housekeeping/Public Area/Laundry (F)"
        ]
    },
    {
        label: "Food & Beverages (FB)", functions: [
            "Food & Beverages (A)", "Recipe Development (B)", "F&B Kitchen (C)", "F&B Service (D)"
        ]
    },
    { label: "Business Development (BD)", functions: ["Business Development (A)", "Business Solution & Innovation (C)"] },
    {
        label: "Merchandising (BM)", functions: [
            "Merchandising (A)", "Space Range & Display (B)", "Product Development (C)", "Buying (D)"
        ]
    },
    {
        label: "Brand Mgmt & Marketing (MK)", functions: [
            "Brand Mgmt. & Marketing (A)", "Marketing Communications (B)", "Promotion (C)", "CRM (D)",
            "Digital Marketing (E)", "Market Research/Intelligence (F)", "Marketing Art & Design (G)",
            "Visual Merchandising (H)", "Event Marketing (J)", "Public Relations (K)"
        ]
    },
    {
        label: "Store Sales and Operations (ST)", functions: [
            "Store Sales and Operations (A)", "Store Operations (B)", "Store Sales (C)",
            "Specialist Sales (D)", "Cashier Service (E)"
        ]
    },
    {
        label: "Sales (SL)", functions: [
            "Sales/Account Manager/Relationship Manager (A)", "Direct Sales (B)",
            "Telesales (C)", "Inline/Omnichannel Sales (D)", "Leasing (E)"
        ]
    },
];

export const ALL_JOB_GROUPING_LABELS = JOB_GROUPINGS.map(g => g.label);

export function getFunctionsForGrouping(groupingLabel: string): string[] {
    return JOB_GROUPINGS.find(g => g.label === groupingLabel)?.functions ?? [];
}
