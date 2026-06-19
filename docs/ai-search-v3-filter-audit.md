# AI Search V3 — Filter System Audit

> **สถานะ: 📋 PLANNING** — ยังไม่ได้แก้โค้ดจริง เอกสารนี้คือ audit result + implementation plan
> สร้างจาก: code review ของ `src/app/ai-search-v3/page.tsx` + `src/app/ai-search-demo/FilterPanel.tsx` + `src/app/actions/ai-search-demo.ts`
> วันที่ตรวจสอบ: 2026-06-14

---

## ปัญหาที่ได้รับแจ้ง

- หน้า AI Search V3 (/ai-search-v3) รู้สึกว่า **ช้ามาก** เวลาใช้ filter หลายอัน
- มีความคิดจะสร้างตาราง pre-computed (deduplicated positions) เพื่อเพิ่มความเร็ว filter

---

## สิ่งที่ตรวจสอบ

### ไฟล์ที่อ่าน

| ไฟล์ | สิ่งที่ดู |
|---|---|
| `src/app/ai-search-v3/page.tsx` (455 บรรทัด) | State management, event handlers, RPC call flow, filter change logic |
| `src/app/ai-search-demo/FilterPanel.tsx` (939 บรรทัด) | Debounce ใน text search, cascading loading state, filter UI |
| `src/app/actions/ai-search-demo.ts` | `getCascadingFilterOptions`, `searchPositionSuggestions`, `searchDemoCandidates`, `fetchCandidatePage` |
| Supabase migrations | ค้นหา `suggest_positions`, `get_cascading_options` — ไม่พบ migration file (ถูก create ใน dashboard โดยตรง) |

### Architecture ที่เข้าใจ

```
user เปลี่ยน filter
        │
        ▼
handleFilterChange(f)          ← ยิงทันที ไม่มี debounce
    ├── setFilters(f)
    └── updateCascading(f)
            │
            ▼
        getCascadingFilterOptions(f)   ← Server Action
            │
            ▼
        get_cascading_options RPC      ← Supabase
            │
            ├── วิ่ง search_candidate_ids ภายใน (หา candidate pool)
            └── คำนวณ DISTINCT 12 dimension พร้อมกัน:
                keywords, levels, positions, companies, countries,
                hotel_ratings, hotel_chains, sub_brands, regions,
                job_functions, genders, nationalities
```

```
user พิมพ์ใน position search box
        │
        ▼ (มี debounce 300ms อยู่แล้วใน PositionSearchPopover)
searchPositionSuggestions(query, filters)
    │
    ├── [ถ้ามี filter อื่น] → search_candidate_ids → suggest_positions(query, ids[])
    └── [ถ้าไม่มี filter]  → suggest_positions(query)
                                    │
                                    └── DISTINCT position FROM candidate_experiences
                                        WHERE position ILIKE '%query%'
                                        (~48,500 rows, ไม่มี trigram index)
```

```
user กด Search
        │
        ▼
runSearch(f)
    ├── search_candidate_ids(all_filters)    ┐ parallel
    └── get_search_summary(all_filters)      ┘
            │
            ▼ (ได้ candidate_ids[] อาจมี 5,000+ รายการ)
        fetchCandidatePage(allCandidateIds, page, PAGE_SIZE)
            │
            └── ส่ง array ทั้งหมดในทุก request (ทุกครั้งที่เปลี่ยนหน้า)
```

---

## ปัญหาทั้งหมดที่พบ

### 🔴 Performance — ส่งผลโดยตรงต่อความช้า

---

#### P1 — ไม่มี debounce บน `handleFilterChange`

**ตำแหน่ง:** `src/app/ai-search-v3/page.tsx:168-171`

```typescript
const handleFilterChange = (f: DemoFilterState) => {
    setFilters(f);
    updateCascading(f);  // ← ยิง get_cascading_options ทันที ทุกครั้ง
};
```

**ผลกระทบ:** user tick checkbox 3 อัน → RPC หนักยิง 3 ครั้งพร้อมกัน แต่ละครั้งคำนวณ 12 dimension บน candidate pool ที่ filter แล้ว ใช้เวลาอย่างน้อยหลายร้อย ms ต่อครั้ง

---

#### P2 — Race condition ใน `updateCascading`

**ตำแหน่ง:** `src/app/ai-search-v3/page.tsx:108-113`

```typescript
const updateCascading = useCallback(async (f: DemoFilterState) => {
    setCascadeLoading(true);
    const opts = await getCascadingFilterOptions(f);  // ← ไม่มี cancel
    setCascadingOptions(opts);
    setCascadeLoading(false);
}, []);
```

**ผลกระทบ:** ถ้า request A (filter เก่า) ส่ง 800ms ก่อน แล้ว request B (filter ใหม่) ส่ง 200ms ทีหลัง — B resolve ก่อน แต่ A resolve ทีหลัง → cascading options แสดงค่าผิด (เป็นของ filter เก่า) ไม่มีวิธีรู้ว่า request ไหน resolve ล่าสุด

---

#### P3 — `ChainRatingPicker` ยิง 2 operation พร้อมกันทันที ไม่มี debounce

**ตำแหน่ง:** `src/app/ai-search-v3/page.tsx:337-344`

```typescript
<ChainRatingPicker
    onFiltersChange={handleFilterChange}  // → updateCascading() ทันที
    onAutoSearch={runSearch}              // → search + summary ทันที
/>
```

**ผลกระทบ:** user คลิก hotel chain 1 ครั้ง = 3 RPC ยิงพร้อมกันทันที:
1. `get_cascading_options` (จาก `handleFilterChange`)
2. `search_candidate_ids` (จาก `runSearch`)
3. `get_search_summary` (จาก `runSearch`)

---

#### P4 — `loadPage` ส่ง candidate_ids array ทั้งหมดทุกครั้งที่เปลี่ยนหน้า

**ตำแหน่ง:** `src/app/ai-search-v3/page.tsx:162-166`

```typescript
async function loadPage(page: number) {
    const data = await fetchCandidatePage(allCandidateIds, page, PAGE_SIZE);
    //                                    ↑ อาจมี 5,000-50,000 IDs
}
```

**ผลกระทบ:** ทุกครั้งที่กด Next/Prev page — serialize array ขนาดใหญ่ใส่ request body แล้วส่งไป server อีกครั้ง ยิ่ง result set ใหญ่ยิ่งช้า

---

#### P5 — `suggest_positions` ไม่มี trigram index (unscoped case)

**ตำแหน่ง:** RPC `suggest_positions` ใน Supabase (ไม่มี migration file)

**ผลกระทบ:** เมื่อ user พิมพ์ชื่อ position โดยยังไม่มี filter อื่น — RPC ต้องทำ `ILIKE '%query%'` full scan บน `candidate_experiences.position` (~48,500+ rows) ทุกครั้งที่พิมพ์ เพราะไม่มี `pg_trgm` GIN index ช่วย

---

### 🟠 UX — user งงหรือเข้าใจผิดสถานะของระบบ

---

#### U1 — ไม่มี indicator ว่า "ผลลัพธ์เก่าแล้ว"

**ตำแหน่ง:** `src/app/ai-search-v3/page.tsx:384-432`

**อาการ:** user เปลี่ยน filter แล้ว — ผลลัพธ์เดิมยังแสดงอยู่ครบถ้วน เหมือนไม่มีอะไรเกิดขึ้น user ไม่รู้ว่าต้องกด Search ใหม่ หรือคิดว่าผลที่เห็นอยู่ตรงกับ filter ที่เลือกไปแล้ว

---

#### U2 — `activeFilterCount` นับ filter ไม่ครบ

**ตำแหน่ง:** `src/app/ai-search-v3/page.tsx:229-233`

```typescript
const activeFilterCount = [
    filters.position_search.length,    // ✅
    filters.position_levels.length,    // ✅
    filters.hotel_ratings.length,      // ✅
    filters.countries.length,          // ✅
    filters.industries.length,         // ✅
    filters.hotel_chains.length,       // ✅
    // ❌ position_keywords ไม่นับ
    // ❌ hotel_sub_brands ไม่นับ
    // ❌ companies ไม่นับ
    // ❌ regions ไม่นับ
    // ❌ job_functions ไม่นับ
    // ❌ genders ไม่นับ
    // ❌ nationalities ไม่นับ
    // ❌ current_only ไม่นับ
    // ❌ current_and_latest ไม่นับ
].reduce((a, b) => a + b, 0);
```

**ผลกระทบ:** ปุ่ม Search ยัง disabled อยู่ทั้งๆ ที่ user เลือก filter บางประเภทไปแล้ว (เช่น job_function, gender, sub_brand) badge นับจำนวน filter ก็แสดงตัวเลขผิด

---

#### U3 — AI ใส่ filter แล้ว cascading options ไม่อัพเดต

**ตำแหน่ง:** `src/app/ai-search-v3/page.tsx:127-142`

```typescript
function applyFiltersFromAI(f: any) {
    setFilters(newFilters);
    runSearch(newFilters);
    // ❌ ไม่ได้เรียก updateCascading(newFilters)
}
```

**ผลกระทบ:** หลัง AI ใส่ filter เช่น `country: Thailand, level: GM` — filter panel ซ้ายแสดง filter ที่เลือกอยู่ถูกต้อง แต่ cascading options (option ที่ไฮไลต์ว่า "มีใน result") ยังเป็นค่าเก่า user เห็น option ที่ไม่ตรงกับ context ปัจจุบัน

---

#### U4 — ไม่มี error state ที่ user เห็น

**ตำแหน่ง:** `src/app/ai-search-v3/page.tsx:144-160`

```typescript
async function runSearch(f: DemoFilterState) {
    setSearching(true);
    try {
        const result = await searchDemoCandidates(f);
        // ...
    } finally {
        setSearching(false);  // ← ถ้า error: spinner หยุด แต่ไม่แสดงอะไรเลย
    }
}
```

**ผลกระทบ:** ถ้า network error หรือ RPC timeout — spinner หยุดหมุน ผลลัพธ์ว่าง user ไม่รู้ว่า search fail หรือแค่ไม่มีผล

---

#### U5 — ไม่ scroll ไปที่ผลหลัง Search

**ตำแหน่ง:** `src/app/ai-search-v3/page.tsx:144-160`

**อาการ:** หลังกด Search — ถ้า chat section เปิดอยู่ (544px) + ChainRatingPicker section อยู่บน — ผลลัพธ์อาจอยู่นอก viewport user ต้อง scroll ลงเองเพื่อดูผล

---

### 🟡 Minor — สะสมเป็นประสบการณ์ที่ไม่ดี

#### M1 — ไม่มี empty state เมื่อ search แล้วไม่เจอผล

ถ้า search แล้วได้ 0 candidates — table แสดงว่างๆ ไม่มี message บอก user ว่าลอง adjust filter

#### M2 — ปุ่ม Reset filter กับปุ่มซ้ายล่าง ซ้ำกัน 2 ที่

มีปุ่ม Reset ทั้งใน FilterPanel และด้านล่างปุ่ม Search ใน page.tsx (line 373-380) อาจ confuse

---

## แนวทางการแก้ปัญหา

### Fix P1 + P2 — Debounce + AbortController

```typescript
// page.tsx
const cascadeAbortRef = useRef<AbortController | null>(null);

const updateCascading = useCallback(async (f: DemoFilterState) => {
    // ยกเลิก request ก่อนหน้า
    cascadeAbortRef.current?.abort();
    const controller = new AbortController();
    cascadeAbortRef.current = controller;

    setCascadeLoading(true);
    try {
        const opts = await getCascadingFilterOptions(f);
        if (!controller.signal.aborted) {
            setCascadingOptions(opts);
        }
    } finally {
        if (!controller.signal.aborted) {
            setCascadeLoading(false);
        }
    }
}, []);

const debouncedCascade = useMemo(
    () => debounce((f: DemoFilterState) => updateCascading(f), 400),
    [updateCascading]
);

const handleFilterChange = (f: DemoFilterState) => {
    setFilters(f);
    debouncedCascade(f);
};
```

> หมายเหตุ: ต้อง install หรือ implement `debounce` utility — ถ้าไม่อยากเพิ่ม dependency ทำ `useRef` + `setTimeout`/`clearTimeout` แทนได้

---

### Fix P3 — ChainRatingPicker debounce

```typescript
// ไม่ให้ runSearch ยิงทันที — รอให้ user หยุดเลือก chain/rating ก่อน
const debouncedAutoSearch = useMemo(
    () => debounce((f: DemoFilterState) => runSearch(f), 600),
    []
);

<ChainRatingPicker
    onFiltersChange={handleFilterChange}     // cascading (400ms debounce)
    onAutoSearch={debouncedAutoSearch}       // search (600ms debounce)
/>
```

---

### Fix P4 — ลด payload ของ pagination

**Option A (ง่าย):** เก็บ IDs ไว้ใน server-side session หรือ cache แทนส่งทุกครั้ง
**Option B (ปลอดภัยกว่า):** ส่งแค่ slice ของ IDs ที่ต้องการ page นั้น ไม่ใช่ทั้งหมด

```typescript
// ใน fetchCandidatePage — server action
// แทนที่จะรับ allIds[] แล้ว slice ใน server
// → รับ slicedIds[] (เฉพาะ 20 ID ของ page นั้น) จาก client แทน

async function loadPage(page: number) {
    const start = (page - 1) * PAGE_SIZE;
    const pageIds = allCandidateIds.slice(start, start + PAGE_SIZE);
    const data = await fetchCandidatePage(pageIds, 1, PAGE_SIZE);
    // fetchCandidatePage ไม่ต้อง slice ใน server อีกต่อไป
}
```

---

### Fix P5 — Trigram index สำหรับ position search

```sql
-- เปิด extension ก่อน (ถ้ายังไม่มี)
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- สร้าง index บน candidate_experiences.position
CREATE INDEX CONCURRENTLY idx_experiences_position_trgm
ON candidate_experiences
USING gin(position gin_trgm_ops)
WHERE position IS NOT NULL;

-- optional: materialized view สำหรับ unscoped autocomplete
CREATE MATERIALIZED VIEW mv_distinct_positions AS
SELECT position, count(DISTINCT candidate_id) AS candidate_count
FROM candidate_experiences
WHERE position IS NOT NULL
GROUP BY position
ORDER BY candidate_count DESC;

CREATE INDEX ON mv_distinct_positions USING gin(position gin_trgm_ops);
-- refresh ด้วย: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_distinct_positions;
```

---

### Fix U1 — Stale results indicator

```typescript
const [filtersChangedSinceSearch, setFiltersChangedSinceSearch] = useState(false);

const handleFilterChange = (f: DemoFilterState) => {
    setFilters(f);
    debouncedCascade(f);
    if (hasSearched) setFiltersChangedSinceSearch(true);  // ← mark stale
};

async function runSearch(f: DemoFilterState) {
    setFiltersChangedSinceSearch(false);  // ← clear เมื่อ search ใหม่
    // ...
}

// ใน JSX — แสดงเมื่อผลเก่า
{filtersChangedSinceSearch && hasSearched && (
    <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
        <AlertCircle className="h-3 w-3" />
        Filter เปลี่ยนแล้ว — กด Search เพื่อดูผลใหม่
    </div>
)}
```

---

### Fix U2 — แก้ `activeFilterCount` ให้นับครบ

```typescript
const activeFilterCount =
    filters.position_search.length +
    filters.position_keywords.length +
    filters.position_levels.length +
    filters.hotel_ratings.length +
    filters.hotel_chains.length +
    filters.hotel_sub_brands.length +
    filters.countries.length +
    filters.regions.length +
    filters.industries.length +
    filters.companies.length +
    filters.job_functions.length +
    filters.genders.length +
    filters.nationalities.length +
    (filters.current_only ? 1 : 0) +
    (filters.current_and_latest ? 1 : 0);
```

---

### Fix U3 — เพิ่ม cascading update ใน `applyFiltersFromAI`

```typescript
function applyFiltersFromAI(f: any) {
    const newFilters: DemoFilterState = { ...EMPTY_FILTERS, ...mappedFilters };
    setFilters(newFilters);
    runSearch(newFilters);
    updateCascading(newFilters);  // ← เพิ่มบรรทัดนี้
}
```

---

### Fix U4 — Error state

```typescript
const [searchError, setSearchError] = useState<string | null>(null);

async function runSearch(f: DemoFilterState) {
    setSearching(true);
    setSearchError(null);
    try {
        const result = await searchDemoCandidates(f);
        // ...
    } catch (err) {
        setSearchError("ไม่สามารถค้นหาได้ กรุณาลองใหม่");
    } finally {
        setSearching(false);
    }
}
```

---

### Fix U5 — Scroll to results

```typescript
const resultsRef = useRef<HTMLDivElement>(null);

async function runSearch(f: DemoFilterState) {
    // ... search logic ...
    setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
}

// ใน JSX
<div ref={resultsRef} className="flex-1 flex flex-col gap-3 min-w-0">
```

---

## สิ่งที่จะได้หลังแก้

| ก่อน | หลัง |
|---|---|
| tick checkbox 3 อัน → 3 RPC ยิงพร้อมกัน | tick checkbox 3 อัน → รอ 400ms → RPC ยิง 1 ครั้ง |
| คลิก chain → 3 RPC พร้อมกันทันที | คลิก chain → debounce → cascade + search ไม่ซ้อนกัน |
| request เก่า resolve ทีหลัง → cascading ผิด | AbortController cancel request เก่า → cascading ถูกเสมอ |
| เปลี่ยนหน้า → serialize IDs ทั้งหมดทุกครั้ง | เปลี่ยนหน้า → ส่งแค่ 20 IDs ของหน้านั้น |
| พิมพ์ position → full scan 48,500 rows | พิมพ์ position → trigram index → milliseconds |
| ผล search เก่าแสดงอยู่ไม่รู้ว่าต้อง re-search | banner เตือน "filter เปลี่ยนแล้ว" |
| Search button disabled ทั้งที่เลือก job_function ไว้แล้ว | Search button เปิดถูกต้องทุกกรณี |
| AI ใส่ filter → cascading ไม่อัพเดต | AI ใส่ filter → cascading อัพเดตทันที |
| search fail → spinner หยุด ไม่รู้ว่า error | แสดง error message ชัดเจน |
| search เสร็จ → ต้อง scroll ลงเอง | scroll ไปที่ผลอัตโนมัติ |

---

## แผนงาน (Execution Order)

### Phase 1 — Performance fixes (ทำก่อน เห็นผลทันที)

| Step | งาน | ไฟล์ที่แตะ | Effort |
|---|---|---|---|
| 1.1 | เพิ่ม debounce 400ms + AbortController ใน `updateCascading` และ `handleFilterChange` | `page.tsx` | ~30 นาที |
| 1.2 | Debounce `onAutoSearch` ใน ChainRatingPicker (600ms) | `page.tsx` | ~10 นาที |
| 1.3 | แก้ `loadPage` ให้ส่งเฉพาะ IDs ของ page นั้น + แก้ `fetchCandidatePage` ให้รับ slice ตรงๆ | `page.tsx`, `ai-search-demo.ts` | ~30 นาที |
| 1.4 | สร้าง trigram index บน `candidate_experiences.position` (migration หรือ SQL ใน dashboard) | Supabase | ~15 นาที |

### Phase 2 — UX fixes (ทำต่อ effort ต่ำมาก)

| Step | งาน | ไฟล์ที่แตะ | Effort |
|---|---|---|---|
| 2.1 | แก้ `activeFilterCount` ให้นับครบทุก field | `page.tsx` | ~5 นาที |
| 2.2 | เพิ่ม `updateCascading` ใน `applyFiltersFromAI` | `page.tsx` | ~2 นาที |
| 2.3 | เพิ่ม stale results indicator | `page.tsx` | ~15 นาที |
| 2.4 | เพิ่ม error state ใน `runSearch` | `page.tsx` | ~10 นาที |
| 2.5 | เพิ่ม scroll to results หลัง search | `page.tsx` | ~5 นาที |

### Phase 3 — Minor (optional)

| Step | งาน | Effort |
|---|---|---|
| 3.1 | Empty state เมื่อผล = 0 | ~10 นาที |
| 3.2 | รวม Reset button ให้เหลือที่เดียว | ~5 นาที |

---

## หมายเหตุ — เรื่องที่ยังเปิดอยู่

- **`get_cascading_options` RPC SQL** — ไม่มี migration file ต้องดู function definition ใน Supabase dashboard ว่าทำ DISTINCT 12 dimension ด้วย subquery แยก หรือ CTE เดียว ถ้าเป็น subquery แยก = optimize ได้อีกมาก (Phase 4 ที่ยังไม่ได้วางแผน)
- **`suggest_positions` scoped case** — ถ้า user มี filter อื่น ยังต้องส่ง `candidate_ids[]` ยักษ์ข้ามไป RPC อยู่ — fix ที่ถูกต้องคือรวมเป็น RPC เดียวที่รับ filter params ทั้งหมด ไม่ใช่ ids array (effort สูงกว่า ยังไม่ได้ include ใน plan นี้)

---

*สร้างเมื่อ: 2026-06-14 | AI Search V3 Filter Audit v1*
