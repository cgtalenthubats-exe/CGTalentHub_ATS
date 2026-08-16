# AI Search System — Overview
*CGTalentHub ATS · Last updated: 2026-05-26*

---

## The Core Problem: Uncontrolled Candidate Data

Candidates enter their own job titles freely — "GM", "General Manager", "Hotel GM", "GM Operations" are all the same role but stored differently. Querying raw text would miss most of them.

### Solution: Position Keyword Vocabulary

A curated vocab table maps hundreds of raw titles → standardized keywords. Every experience row gets tagged at import time.

```
"GM" / "General Manager" / "Hotel GM"  →  position_keyword = "General Manager"
"FOM" / "Front Office Manager"          →  position_keyword = "Front Office Manager"
```

When a recruiter searches "GM":
1. System looks up keyword + all aliases in vocab table
2. Tags matched keywords before sending to AI
3. AI also picks up intent from natural language
4. RPC filters on `position_keyword` — fast, consistent, alias-aware
5. **Vocab can be updated anytime** — new aliases take effect on next search, no re-import needed

---

## Why a Secondary Filter Bar Exists

Every main search hits the database — fine for the first query, expensive for exploration.

**Without secondary filter:**
> Search "GM Thailand" → 157 results → want to narrow to Marriott only → **hit DB again**

**With secondary filter:**
> Search once → 157 results loaded → filter by Company / Country / Position **client-side, instant**

The secondary bar also supports **Experience Scope**:

| Mode | Meaning |
|---|---|
| Current + Latest | Current job, or most recent if no current |
| Current Only | Only actively employed candidates |
| All Experiences | Entire career history |

Example use case:
> "Who currently works at SALA but has past experience at Marriott?"
→ Switch to **All Experiences**, select both companies — no new DB query needed.

---

## Country System: Two Sources, One Purpose

Candidate location data comes from two places with different meanings:

| Source | Meaning | Used For |
|---|---|---|
| `candidate_experiences.country` | Country where the job was held | Work Country filter |
| `candidate_profile_enhance.country` | Where candidate lives now | "Based In" filter |

### Quality Rule: Exclude HQ-Guessed Locations

`candidate_experiences` has a `note` field per row. When `note = "Location from HQ"`, the system *guessed* the country from the company's HQ — not from what the candidate actually wrote.

These rows are **excluded from the Work Country filter** to avoid false matches.

> Example: A candidate who worked at Accor Paris would be incorrectly tagged as Thailand if Accor Thailand is the registered HQ — so we filter it out.

Only rows with `note ILIKE '%profile input%'` count toward Work Country filtering.

**Coverage:** ~31,380 profile-input rows (reliable) · ~13,475 HQ-guessed rows (excluded from filter)

---

## Hotel Chain System

Raw company names like "InterContinental Bangkok" or "JW Marriott Phuket" are meaningless for filtering at scale. The chain system adds structure:

```
company_master.hotel_chain_id
        ↓
hotel_chain_master (sub-brand)  →  "InterContinental"  · 5★
        ↓ parent_id
hotel_chain_master (parent)     →  "IHG Hotels & Resorts"
```

### What Recruiters Can Filter By

- **Parent chain** — "Show anyone from IHG" (catches all sub-brands automatically)
- **Sub-brand** — "Show only InterContinental" (specific)
- **Star rating** — 3★ / 4★ / 5★

### Dynamic Chain Counts

Chain chips on the UI show candidate counts that **update dynamically** as other filters change. Selecting "Thailand" immediately shows how many IHG candidates are in Thailand — not the global count.

### AI Query Support

Natural language queries like "Find GM from Marriott or IHG in Thailand" automatically set `hotel_chains` filter — the AI knows all 92 parent chains and 399 sub-brands.

**Current coverage:** 1,282 companies mapped · ~16,000 remaining (admin mapping UI built, pending use)

---

## Internal Candidate Filter

Candidates tagged `candidate_status = ["Internal Candidate"]` can be surfaced instantly with one toggle — combines with all other filters.

> "Show Internal Candidates who are Directors, currently in Thailand, from a 5★ chain"

**Current count:** 150 verified internal candidates, cross-referenced against `internal_candidate_group` source table.

Note: `candidate_status` is a `text[]` array — a candidate can have multiple statuses simultaneously (e.g. `["Internal Candidate", "Over-aged"]`).

---

## System Architecture

```
User Input (Natural Language or Manual Filters)
        ↓
Claude Haiku — parse to filter JSON (~500ms)
        ↓
search_candidate_ids() RPC — PostgreSQL
  JOIN: candidate_experiences
      + company_master
      + hotel_chain_master (x2, for sub-brand → parent)
      + Candidate Profile
      + country
  → returns candidate_id[]
        ↓
fetchCandidatePage() — slice IDs, fetch profiles + experiences
        ↓
Client-side: Secondary filter bar, Cohort Insights, Pagination
```

**Database tables involved in search:**

| Table | Role |
|---|---|
| `candidate_experiences` | Core search base — position, company, country, dates |
| `Candidate Profile` | Gender, nationality, age, job function, candidate_status |
| `company_master` | Industry, group, hotel_chain_id |
| `hotel_chain_master` | Chain name, sub-brand, star rating |
| `country` | Country → Region mapping |
| `candidate_profile_enhance` | Current location (Based In filter) |
| `position_keyword_vocab` | Keyword + aliases for AI pre-match |

---

## Limits & Long-Term Solutions

| Limit | Root Cause | Short-Term | Long-Term |
|---|---|---|---|
| 1–5 sec search time | 5-table JOIN + ROW_NUMBER() on ~49k rows every query | Add indexes on `position_keyword`, `country`, `is_current_job` | **Materialized View** — pre-compute nightly, query a single flat table |
| Sub-filter loads slowly on 500+ results | Fetches all profiles in background after search | Acceptable at current scale | Compute sub-filter options server-side via RPC |
| Hotel chain coverage gaps | ~16k companies not yet mapped | Manual mapping via admin UI | AI-assisted batch mapping via n8n |
| Candidates without experience rows excluded from search | RPC starts from `candidate_experiences`, not `Candidate Profile` | Insert experience rows case-by-case | Restructure RPC to LEFT JOIN from profile outward |
| Scale ceiling ~50k candidates on current plan | Shared compute (Supabase Free) | — | Supabase Pro (dedicated compute) + Materialized View |

### What is a Materialized View?

Instead of computing 5-table JOINs on every search, pre-compute the result into a flat table (`mv_candidate_search`) and refresh it nightly:

```sql
-- Instead of 5 JOINs every time:
SELECT * FROM mv_candidate_search
WHERE country = 'Thailand'
  AND hotel_chain = 'IHG Hotels & Resorts'
-- 5–10x faster
```

**Trade-off:** Data is not real-time — reflects the last refresh. Acceptable for ATS since candidate data changes infrequently (import-based, not live).

---

## Current Scale

| Metric | Count |
|---|---|
| Candidates | ~9,400 |
| Experience rows | ~49,300 |
| Hotel chains mapped | 1,282 companies |
| Internal candidates | 150 |
| Avg experiences per candidate | ~5 |

---

> **One-line summary:**
> We don't search raw text — we search structured, enriched, normalized talent data. The AI layer just makes it feel like a conversation.
