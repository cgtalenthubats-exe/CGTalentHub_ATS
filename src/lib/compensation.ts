/**
 * Reading, writing and interpreting compensation values.
 *
 * Every form, API route and report goes through here rather than touching `Candidate Profile`
 * columns directly, so moving compensation to its own table later is a change to this file
 * instead of a rewrite of thirteen.
 */

import {
    BENEFIT_PROVIDED_COLUMN,
    COMPENSATION_FIELDS,
    COMPENSATION_KEYS,
    isNumericField,
    type CompensationField,
} from "./compensation-fields";

/** Form state: every field as a string, plus the provided/not-provided answers. */
export interface CompensationDraft {
    values: Record<string, string>;
    provided: Record<string, boolean>;
}

/**
 * What we know about one benefit.
 * - `unknown`  — nobody has answered; must not be counted as "doesn't have it"
 * - `none`     — confirmed they don't get it
 * - `provided` — they get it, amount not recorded
 * - `amount`   — they get it and we know how much
 */
export type BenefitState = "unknown" | "none" | "provided" | "amount";

export function parseAmount(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") return isFinite(value) ? value : null;
    const cleaned = String(value).replace(/[^0-9.-]/g, "");
    if (!cleaned) return null;
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
}

export function formatAmount(value: unknown): string {
    const n = parseAmount(value);
    if (n === null) return "";
    return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function readProvidedMap(row: any): Record<string, boolean> {
    const raw = row?.[BENEFIT_PROVIDED_COLUMN];
    if (!raw) return {};
    // The column is jsonb, but a row that came back through an untyped client can hand us a string.
    const parsed = typeof raw === "string" ? safeParse(raw) : raw;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, boolean> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([k, v]) => {
        if (typeof v === "boolean") out[k] = v;
    });
    return out;
}

function safeParse(value: string): unknown {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

/** Pulls a candidate row into form state. */
export function readCompensation(row: any): CompensationDraft {
    const values: Record<string, string> = {};
    COMPENSATION_FIELDS.forEach(field => {
        const raw = row?.[field.key];
        if (raw === null || raw === undefined) {
            values[field.key] = "";
        } else if (isNumericField(field)) {
            values[field.key] = formatAmount(raw);
        } else {
            values[field.key] = String(raw);
        }
    });
    return { values, provided: readProvidedMap(row) };
}

/**
 * Turns form state into a database payload.
 *
 * Only keys present in `draft.values` are written, so a form that edits part of the compensation
 * block doesn't blank the fields it never showed.
 */
export function buildCompensationPayload(draft: CompensationDraft): Record<string, any> {
    const payload: Record<string, any> = {};

    COMPENSATION_FIELDS.forEach(field => {
        if (!(field.key in draft.values)) return;
        const raw = draft.values[field.key];
        if (isNumericField(field)) {
            const n = parseAmount(raw);
            payload[field.key] = n === null ? null : (field.type === "int" ? Math.round(n) : n);
        } else {
            const text = typeof raw === "string" ? raw.trim() : raw;
            payload[field.key] = text ? text : null;
        }
    });

    // Drop keys that were never answered so the column stays a record of real answers rather
    // than a wall of `false`.
    const provided: Record<string, boolean> = {};
    Object.entries(draft.provided || {}).forEach(([key, value]) => {
        if (typeof value === "boolean") provided[key] = value;
    });
    payload[BENEFIT_PROVIDED_COLUMN] = Object.keys(provided).length > 0 ? provided : null;

    return payload;
}

export function benefitState(field: CompensationField, row: any, provided?: Record<string, boolean>): BenefitState {
    const map = provided ?? readProvidedMap(row);
    const amount = isNumericField(field) ? parseAmount(row?.[field.key]) : null;
    const hasText = !isNumericField(field) && !!row?.[field.key];

    if (amount !== null && amount > 0) return "amount";
    if (hasText) return "amount";
    if (map[field.key] === true) return "provided";
    if (map[field.key] === false) return "none";
    if (amount === 0) return "none";
    return "unknown";
}

/**
 * Counting rules, in one place so every report agrees.
 *
 * The denominator is candidates who have an answer — counting everyone would fold "nobody asked"
 * into "doesn't get it", which is the reporting bug this whole change exists to fix.
 */
export function benefitCoverage(
    rows: any[],
    field: CompensationField
): { provided: number; none: number; unknown: number; answered: number; coveragePct: number | null } {
    let provided = 0;
    let none = 0;
    let unknown = 0;

    rows.forEach(row => {
        const state = benefitState(field, row);
        if (state === "amount" || state === "provided") provided++;
        else if (state === "none") none++;
        else unknown++;
    });

    const answered = provided + none;
    return {
        provided,
        none,
        unknown,
        answered,
        coveragePct: answered > 0 ? Math.round((provided / answered) * 100) : null,
    };
}

/** Amounts worth averaging: a recorded figure above zero. */
export function amountsForStats(rows: any[], field: CompensationField): number[] {
    if (!isNumericField(field)) return [];
    return rows
        .map(row => parseAmount(row?.[field.key]))
        .filter((n): n is number => n !== null && n > 0);
}

/** Columns a query must select to build the full compensation picture. */
export const COMPENSATION_SELECT = [...COMPENSATION_KEYS, BENEFIT_PROVIDED_COLUMN].join(", ");
