/**
 * The compensation & benefits schema, declared once.
 *
 * These fields were previously spelled out by hand in three entry forms, two API whitelists, the
 * preview card, the dashboard benefit table and the benchmark query — eight places for one field,
 * and the forms had already drifted apart (they formatted different subsets of the numbers).
 * Everything now derives from this list, so adding a benefit is an edit here plus a migration.
 *
 * All amounts live on `Candidate Profile`. When compensation eventually moves to its own table
 * (see docs/compensation_benefits_fields.md §7), only this file and src/lib/compensation.ts
 * should need to change.
 */

export type CompensationFieldType = "money" | "percent" | "int" | "text" | "textarea" | "multiselect" | "select";

export type CompensationGroup = "salary" | "allowance" | "health" | "leave" | "other";

export interface CompensationField {
    key: string;
    label: string;
    /** Shown next to the label: ฿/M, ฿/Yr, %, months, days, people. */
    unit?: string;
    type: CompensationFieldType;
    group: CompensationGroup;
    /** Short help under the input. */
    hint?: string;
    /** Choices for `multiselect` (stored comma-separated) and `select` (stored as-is). */
    options?: readonly string[];
    /**
     * Benefit can be marked as provided without an amount — the "we know they get a provident
     * fund but not the rate" case. State lives in the shared `benefit_provided` jsonb column.
     */
    trackProvided?: boolean;
    /**
     * Still read and displayed where a value exists, but no longer offered for entry.
     * `medical_b_mth` is retired in favour of `dental_b_mth`: the two mean different things, so
     * the old column keeps its data instead of being relabelled.
     */
    retired?: boolean;
}

export const COMPENSATION_GROUP_LABELS: Record<CompensationGroup, string> = {
    salary: "Salary",
    allowance: "Allowances",
    health: "Health & Welfare",
    leave: "Leave & Education",
    other: "Other",
};

export const COMPENSATION_FIELDS: readonly CompensationField[] = [
    // --- Salary ---
    {
        key: "gross_salary_base_b_mth",
        label: "Base Salary (Gross)",
        unit: "฿/M",
        type: "money",
        group: "salary",
        hint: "Gross — before tax and social security deductions",
    },
    { key: "bonus_mth", label: "Bonus", unit: "months", type: "money", group: "salary", hint: "Bonus entitlement, in number of months" },
    {
        key: "service_charge_b_mth",
        label: "Service Charge",
        unit: "฿/M",
        type: "money",
        group: "salary",
        trackProvided: true,
        hint: "Common in hotel roles",
    },
    { key: "other_income", label: "Other Income", type: "text", group: "salary", hint: "Anything else that adds to take-home pay" },

    // --- Allowances ---
    { key: "car_allowance_b_mth", label: "Car Allowance", unit: "฿/M", type: "money", group: "allowance", trackProvided: true, hint: "Cash allowance, not a company car" },
    { key: "gasoline_b_mth", label: "Gasoline", unit: "฿/M", type: "money", group: "allowance", trackProvided: true, hint: "Fuel allowance or reimbursement" },
    { key: "phone_b_mth", label: "Phone", unit: "฿/M", type: "money", group: "allowance", trackProvided: true, hint: "Mobile/phone bill allowance" },
    { key: "meal_allowance_b_mth", label: "Meal Allowance", unit: "฿/M", type: "money", group: "allowance", trackProvided: true, hint: "On top of duty meals, if any" },
    {
        // Column name still says "for_expat" — the label dropped it, renaming the column would
        // break every reader for no gain. Free text because the existing values are notes.
        key: "housing_for_expat_b_mth",
        label: "Housing",
        unit: "฿/M",
        type: "text",
        group: "allowance",
        trackProvided: true,
        hint: "Amount or arrangement",
    },
    {
        key: "flight_hometown_cover",
        label: "Flight to Hometown — Cover",
        type: "select",
        group: "allowance",
        trackProvided: true,
        hint: "Who the flight benefit covers",
        options: ["Self", "Immediate Family", "Family"],
    },
    {
        key: "flight_hometown_class",
        label: "Flight to Hometown — Class",
        type: "select",
        group: "allowance",
        hint: "Cabin class flown",
        options: ["Economy", "Business"],
    },

    // --- Health & welfare ---
    { key: "provident_fund_pct", label: "Provident Fund", unit: "%", type: "percent", group: "health", trackProvided: true, hint: "Employer contribution rate" },
    { key: "medical_b_annual", label: "Medical", unit: "฿/Yr", type: "money", group: "health", trackProvided: true, hint: "General medical cover" },
    { key: "dental_b_mth", label: "Dental", unit: "฿/M", type: "money", group: "health", trackProvided: true, hint: "Dental benefit" },
    { key: "ipd_b_annual", label: "IPD", unit: "฿/Yr", type: "money", group: "health", trackProvided: true, hint: "In-patient cover" },
    { key: "opd_b_annual", label: "OPD", unit: "฿/Yr", type: "money", group: "health", trackProvided: true, hint: "Out-patient cover" },
    {
        key: "insurance",
        label: "Insurance",
        type: "multiselect",
        group: "health",
        hint: "Who the insurance covers",
        options: ["Self", "Immediate family", "Can Subscribe"],
    },
    { key: "medical_b_mth", label: "Medical (monthly, legacy)", unit: "฿/M", type: "money", group: "health", retired: true },

    // --- Leave & education ---
    { key: "annual_leave_days", label: "Annual Leave", unit: "days/yr", type: "int", group: "leave", trackProvided: true, hint: "Entitlement in days per year" },
    { key: "education_support_children", label: "Education Support", unit: "children", type: "int", group: "leave", trackProvided: true, hint: "How many children they would claim for" },
    { key: "education_support_b_annual", label: "Education Budget", unit: "฿/Yr", type: "money", group: "leave", hint: "Total budget, not per child" },

    // --- Other ---
    { key: "others_benefit", label: "Note", type: "textarea", group: "other", hint: "Anything else worth recording" },
] as const;

/** The jsonb column holding the provided/not-provided answer per benefit. */
export const BENEFIT_PROVIDED_COLUMN = "benefit_provided";

/** Every compensation column, including retired ones — used for reads and API whitelists. */
export const COMPENSATION_KEYS = COMPENSATION_FIELDS.map(f => f.key);

/** Fields offered in the entry forms, in display order. */
export const EDITABLE_COMPENSATION_FIELDS = COMPENSATION_FIELDS.filter(f => !f.retired);

export const NUMERIC_COMPENSATION_TYPES: CompensationFieldType[] = ["money", "percent", "int"];

export function isNumericField(field: CompensationField): boolean {
    return NUMERIC_COMPENSATION_TYPES.includes(field.type);
}

export function getCompensationField(key: string): CompensationField | undefined {
    return COMPENSATION_FIELDS.find(f => f.key === key);
}

export function compensationFieldsByGroup(): { group: CompensationGroup; label: string; fields: CompensationField[] }[] {
    const order: CompensationGroup[] = ["salary", "allowance", "health", "leave", "other"];
    return order
        .map(group => ({
            group,
            label: COMPENSATION_GROUP_LABELS[group],
            fields: EDITABLE_COMPENSATION_FIELDS.filter(f => f.group === group),
        }))
        .filter(g => g.fields.length > 0);
}
