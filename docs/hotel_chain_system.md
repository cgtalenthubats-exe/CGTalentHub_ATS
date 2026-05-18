# Hotel Chain System — Context & Architecture

> **ACTIVE FOLLOW UP** — ระบบนี้สร้างไว้แล้วบางส่วน งานหลักที่ยังค้างคือ mapping coverage และ dynamic counts
> อ่านไฟล์นี้ก่อนทุกครั้งที่แตะ hotel chain filter, ChainRatingPicker, หรือ company_master mapping
> อย่า recreate สิ่งที่มีอยู่แล้ว — ดูหัวข้อ "สถานะปัจจุบัน & งานที่ต้องทำต่อ" ท้ายไฟล์

---

## Overview

ระบบนี้เชื่อม candidate_experiences → company_master → hotel_chain_master เพื่อให้รู้ว่า candidate แต่ละคนเคยทำงานที่ **hotel chain ไหน**, **sub-brand อะไร**, และ **star rating เท่าไหร่** — โดยไม่ต้องดูชื่อบริษัทดิบ

**Use cases:**
- Filter หา candidates ที่เคยทำใน 5-star chain เช่น Marriott หรือ IHG
- Filter ลงไปถึง sub-brand เช่น "InterContinental" หรือ "JW Marriott"
- แสดง hotel chain + star rating badge ใน candidate table

---

## Data Relationships

```
candidate_experiences
  └── company_id (bigint)
        ↓
company_master
  ├── company_id (PK)
  ├── company_master (ชื่อบริษัท)
  ├── rating (text) — star rating ของบริษัทนี้ เช่น "5 Star"
  └── hotel_chain_id (FK) → hotel_chain_master.brand_id
                                    ↓
                           hotel_chain_master
                             ├── brand_id (PK)
                             ├── brand_name — ชื่อ chain หรือ sub-brand
                             ├── parent_id (FK, nullable) → brand_id ของ parent chain
                             └── rating — star rating ของ sub-brand นี้
```

**กฎสำคัญ:**
- `parent_id IS NULL` = parent chain (เช่น "IHG Hotels & Resorts", "Marriott International")
- `parent_id IS NOT NULL` = sub-brand (เช่น "InterContinental", "Holiday Inn", "JW Marriott")
- `company_master.hotel_chain_id` ชี้ไปที่ **sub-brand** เกือบทั้งหมด (1,281/1,282 บริษัท) — ไม่ใช่ parent chain
- rating ที่ใช้จริงมาจาก `hotel_chain_master.rating` ของ sub-brand หรือ `company_master.rating` ก็ได้

---

## Database Tables

### hotel_chain_master

| Column | Type | หมายเหตุ |
|---|---|---|
| brand_id | integer PK | auto |
| brand_name | text | ชื่อ chain หรือ sub-brand |
| parent_id | integer FK | null = parent chain, มีค่า = sub-brand |
| rating | text | "3 Star" / "4 Star" / "5 Star" / null |
| company_id | bigint | FK → company_master (บริษัทแม่ของ chain เช่น IHG = 430) |
| created_at | timestamptz | |

**สถิติปัจจุบัน:** 92 parent chains, 399 sub-brands

**ตัวอย่าง IHG:**
- brand_id=1, brand_name="IHG Hotels & Resorts", parent_id=NULL, rating=NULL
- brand_id=2, brand_name="InterContinental", parent_id=1, rating="5 Star"
- brand_id=9, brand_name="Crowne Plaza", parent_id=1, rating="5 Star"
- brand_id=10, brand_name="Holiday Inn", parent_id=1, rating="4 Star"

### company_master (ส่วนที่เกี่ยวข้อง)

| Column | Type | หมายเหตุ |
|---|---|---|
| company_id | bigint PK | |
| company_master | text | ชื่อบริษัท |
| industry | text | |
| group | text | เช่น "Hospitality/Real Estate" |
| rating | text | star rating ของบริษัทนี้ |
| hotel_chain_id | integer FK | → hotel_chain_master.brand_id |

**Coverage ปัจจุบัน:**
- mapped (hotel_chain_id NOT NULL): **1,282 บริษัท**
- ยังไม่ map: **16,892 บริษัท** ← งานที่ต้องทำต่อ
- มี rating แต่ไม่มี chain: 186 บริษัท
- มี chain แต่ไม่มี rating: 461 บริษัท

---

## RPC Functions (Supabase)

| Function | Input | Output | ใช้ทำอะไร |
|---|---|---|---|
| `get_chain_candidate_counts()` | — | `[{chain_name, candidate_count}]` | นับ candidate per chain สำหรับแสดงบน chip |
| `get_company_chain_info(p_company_ids bigint[])` | company_ids[] | `[{company_id, chain_name, effective_rating}]` | enrich experiences ด้วย chain + rating |
| `search_candidate_ids(...)` | filter params รวม p_hotel_chains, p_hotel_ratings, p_hotel_sub_brands | candidate_ids[] | search หลัก |
| `get_cascading_options(...)` | filter params | options per field | cascading filter |
| `get_search_summary(...)` | filter params | {total, current, companies, countries} | summary cards |

**Hotel-related params ใน search/cascading/summary:**
```
p_hotel_chains     text[]  — ชื่อ parent chain เช่น ["IHG Hotels & Resorts"]
p_hotel_ratings    text[]  — ["3 Star", "4 Star", "5 Star", "Unknown"]
p_hotel_sub_brands text[]  — ชื่อ sub-brand เช่น ["InterContinental", "Holiday Inn"]
```

---

## Frontend Components

### ChainRatingPicker.tsx
`src/app/ai-search-demo/ChainRatingPicker.tsx`

UI component แสดงอยู่ด้านบน filter panel + results บน /ai-search-demo

**Features:**
- Chain chips (แสดง candidate count) — search ได้ — show more/less
- Star rating buttons: ★★★ / ★★★★ / ★★★★★
- Sub-brand section: แสดงทุก sub-brands เสมอ (filter ตาม chain ที่เลือก) — มี search input
- Auto-trigger search ทุกครั้งที่ toggle chain/rating/sub-brand
- Clear all button

**Props:**
```typescript
chainCounts: { chain_name: string; candidate_count: number }[]
subBrandsByChain: Record<string, string[]>  // chain name → sub-brand names[]
filters: DemoFilterState
onFiltersChange: (f: DemoFilterState) => void
onAutoSearch: (f: DemoFilterState) => void
```

**Constants:**
- `VISIBLE_CHAINS = 16` — แสดง 16 chains แรก
- `VISIBLE_SUB_BRANDS = 20` — แสดง 20 sub-brands แรก

### DemoFilterState (types.ts)
Hotel-related fields:
```typescript
hotel_chains:     string[]  // parent chain names
hotel_ratings:    string[]  // ["3 Star", "4 Star", "5 Star"]
hotel_sub_brands: string[]  // sub-brand names
```

### getDemoFilterOptions() (ai-search-demo.ts server action)
โหลด chain data 1 ครั้งตอนเปิดหน้า:
- `get_chain_candidate_counts` RPC → `chainCounts`
- `hotel_chain_master WHERE parent_id IS NULL` → parent chains list
- `hotel_chain_master WHERE parent_id IS NOT NULL` → sub-brands grouped by chain

### fetchCandidatePage() (ai-search-demo.ts)
Enriches experiences ด้วย `get_company_chain_info` RPC → `hotel_chain_name` + `hotel_rating` per experience

### CandidateTableView (table-view.tsx)
เมื่อ `showHotelColumn=true` — แสดง hotel chain badge + star rating badge จาก `latestExp`

---

## Mapping Process — วิธีที่ใช้ทำครั้งแรก (สำคัญ อย่าลืม)

### ข้อมูลต้นฉบับ: hotel_group table
```
hotel_group:
  hotel_chain  → ชื่อ parent chain  เช่น "IHG Hotels & Resorts"
  brand_name   → ชื่อ sub-brand     เช่น "InterContinental"
  clean_name   → uppercase version  เช่น "INTERCONTINENTAL"
  star         → rating             เช่น "5 Star"
```
ตารางนี้คือ reference data ต้นฉบับ → populate เข้า hotel_chain_master (parent + sub-brands)

### Mapping Logic (ที่ใช้จริง)
1. Match `company_master.company_master` กับ `hotel_group.brand_name` (sub-brand ก่อน)
2. ถ้า match → set `hotel_chain_id` = brand_id ของ sub-brand นั้น
3. **ไม่ใช้ fuzzy match โดยเจตนา** — เพราะ Holiday Inn (4★) ≠ Holiday Inn Express (3★) rating ต่างกัน ถ้า fuzzy ผิดจะทำให้ข้อมูล rating ผิดตาม

### ทำไมถึงใช้ sub-brand เป็นหลัก (ไม่ใช่ parent chain)
- แต่ละ sub-brand มี rating ของตัวเอง — granularity ที่ต้องการ
- parent chain ไม่มี rating (เช่น IHG Hotels & Resorts ไม่มี star rating — rating อยู่ที่ InterContinental, Holiday Inn ฯลฯ)
- การ map ไปที่ parent = รู้แค่ chain แต่ไม่รู้ star rating

### สิ่งที่ตกหล่น (เข้าใจแล้ว ไม่ใช่ bug)
- **Parent company records**: "Marriott International", "Accor", "Hilton" — ชื่อตรงกับ parent chain ไม่มี sub-brand ที่ชื่อเหมือน → map ไม่ได้
- **Property names ที่ไม่มี sub-brand keyword**: "Marriott Sukhumvit", "Le Méridien Chiang Mai" → ต้องการ fuzzy match แต่เจตนาไม่ทำเพราะ accuracy
- **ผลลัพธ์**: 1,253 mapped / 4,158 unmapped ใน Hospitality & Real Estate

### สำหรับ parent company records — แก้ได้ปลอดภัย
บริษัทที่ชื่อตรงกับ parent chain (เช่น "Marriott International" → chain "Marriott International") map ได้โดยตรง
→ ได้ chain info แต่ rating = NULL (รับได้ เพราะ parent ไม่มี rating อยู่แล้ว)
→ ต้องใช้ company_master.rating แทนถ้าจะแสดง star

---

## Migrations ที่เกี่ยวข้อง (ทั้งหมด apply แล้ว)

```
20260513065614  create_brand_master_table
20260513095142  rename_brand_master_to_hotel_chain_master
20260513095314  populate_hotel_chain_master_from_hotel_group
20260513095321  map_company_master_hotel_chain_id
20260513100518  create_hotel_chain_master_view
20260513110413  add_hotel_chain_filter_to_search_rpcs
20260513112310  fix_ihg_hotel_chain_mapping
20260513112436  fix_rpc_hotel_chain_parent_fallback
20260513151717  add_hotel_sub_brand_filter_and_chain_counts
20260513154844  add_get_company_chain_info_rpc
20260514054642  add_current_and_latest_to_cascading_options_v2
```

---

## สถานะปัจจุบัน & งานที่ต้องทำต่อ

### ✅ ทำแล้ว
- hotel_chain_master populated (92 chains, 399 sub-brands พร้อม rating)
- company_master.hotel_chain_id mapped สำหรับ hospitality companies ที่รู้จัก (1,282 บริษัท)
- RPC filter รองรับ chain/rating/sub-brand ครบ
- ChainRatingPicker UI พร้อม
- Table แสดง chain + rating badge
- Cascading options รองรับ hotel filters

### 🔴 งานที่ต้องทำต่อ

**1. Hotel Chain Mapping UI ใน /admin/companies** ← spec อยู่ด้านล่าง
- เพิ่ม column `chain_mapping_status` ใน company_master ก่อน
- แล้ว build UI สำหรับ admin ทำ mapping

**2. Map parent company backlog ด้วย SQL (quick win)**
- "Marriott International" 215 candidates, "Accor" 192, "Hilton" 70 ฯลฯ
- ชื่อตรงกับ parent chain → map ได้เลย → rating ใช้ company_master.rating แทน

**3. Chain counts ไม่ dynamic**
- โหลด 1 ครั้งตอนเปิดหน้า ไม่ update ตาม filter อื่น
- filter "Thailand" → chain count ยังแสดงตัวเลข global

**4. Sub-brands ไม่มี candidate count**
- Chain chips แสดงจำนวน แต่ sub-brand chips แสดงแค่ชื่อ

**5. Parent chain ไม่มี rating**
- rating อยู่ที่ sub-brand เท่านั้น
- `effective_rating` ใน get_company_chain_info derive จาก company_master.rating หรือ sub-brand rating

---

## Hotel Chain Mapping UI — Spec (งานที่ต้องสร้าง)

### ที่อยู่
ต่อยอดจาก `/admin/companies` → เพิ่ม tab หรือ section "Hotel Chain Mapping"
ไฟล์ที่แตะ: `src/app/admin/companies/page.tsx`, `src/components/admin/CompanyManagementClient.tsx`

### DB: เพิ่มก่อน
```sql
ALTER TABLE company_master
ADD COLUMN chain_mapping_status text;
-- NULL         = ยังไม่ได้ดู (default)
-- 'mapped'     = มี hotel_chain_id แล้ว (set อัตโนมัติเมื่อ assign)
-- 'independent'= user ยืนยันว่าไม่ใช่ chain hotel (boutique, resort เดี่ยวๆ)
-- 'pending'    = รอ review
```

### Queue Table
แสดง company ที่:
- `group = 'Hospitality & Real Estate'`  ← ชื่อที่ใช้จริงใน DB (ไม่ใช่ "Hospitality/Real Estate")
- `hotel_chain_id IS NULL`
- `chain_mapping_status IS NULL OR status = 'pending'`
- เรียงตาม candidate_count DESC

Columns: Company Name | Rating | Candidates | Assign Chain | Assign Rating | Mark Independent

### Chain Picker Dropdown — 2 levels
```
IHG Hotels & Resorts
  ├── InterContinental (5★)
  ├── Crowne Plaza (5★)
  └── Holiday Inn (4★)
Marriott International
  ├── JW Marriott (5★)
  └── Courtyard (3★)
──────────────────────
+ Add new chain (parent)
+ Add new sub-brand under existing chain
```
เมื่อ assign → UPDATE hotel_chain_id + SET chain_mapping_status = 'mapped'

### Add New Chain/Sub-brand Form
Fields:
- ชื่อ chain หรือ sub-brand
- ประเภท: Parent chain / Sub-brand (dropdown เลือก parent)
- Rating: 3★ / 4★ / 5★ / ไม่มี
- → INSERT hotel_chain_master → map company ทันที

### Rating Picker (standalone)
สำหรับ company ที่รู้จาก context แต่ไม่รู้ chain:
- Dropdown: 3★ / 4★ / 5★
- UPDATE company_master.rating

### ปุ่ม "Independent"
- SET chain_mapping_status = 'independent'
- ออกจาก queue ทันที
- ยังสามารถ assign rating ได้

### Filter ใน Queue
- ซ่อน independent (default) — toggle แสดงได้
- Filter: ทั้งหมด / เฉพาะที่มี candidates / เฉพาะ pending

---

*Last updated: 2026-05-18 | Hotel Chain System v1*
