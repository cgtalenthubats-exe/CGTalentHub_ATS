# CGTalentHub ATS — Project Context

## โปรเจคนี้คืออะไร
ระบบ ATS (Applicant Tracking System) สำหรับบริษัท CG Talent Hub ที่เชี่ยวชาญด้าน Hospitality recruitment (โรงแรม, F&B, Luxury)
Stack: Next.js 15 + Supabase + Anthropic Claude AI + n8n (workflow automation)

---

## ภาพรวมระบบ — AI Pipeline (Stage 1–3.5)

```
User Query / Filter
        ↓
Stage 1 — SQL Retrieval        ← AI Search Demo ทำอยู่ตอนนี้
  ได้: 200–1,000 คน
        ↓
Stage 2 — AI Screening (Haiku, batch 25)
  pass/fail เทียบ JD/criteria
  ได้: ~100–200 คน
        ↓
Stage 2.5 — Chat Notification
  n8n insert สรุปผล stage 2 เข้า chat
        ↓
Stage 3 — AI Ranking (Sonnet, batch 10)
  score + rank → Top 20–50 คน
        ↓
Stage 3.5 — Chat Notification
  n8n insert สรุปผล stage 3 เข้า chat
```

Stage 2–3.5 รันผ่าน n8n workflow (webhook trigger) ไม่ได้อยู่ใน Next.js โดยตรง

---

## Key Database Tables

| Table | ความหมาย |
|---|---|
| `Candidate Profile` | ข้อมูลหลักของ candidate (candidate_id, name, photo, job_function, candidate_status...) |
| `candidate_experiences` | ประวัติการทำงาน (position, company, country, is_current_job, company_id, position_keyword, position_level...) |
| `company_master` | ข้อมูลบริษัท (company_master=ชื่อ, industry, group, rating=star rating, company_id) |
| `job_requisitions` | JR แต่ละโปรเจค (jr_id เช่น JR000214, position_jr, bu, sub_bu, jr_type) |
| `jr_candidates` | เชื่อม candidate กับ JR (jr_candidate_id, jr_id, candidate_id, temp_status='Pool Candidate', list_type, rank) |
| `status_log` | audit trail ทุก status change ของ candidate ใน JR |
| `position_keyword_vocab` | vocab สำหรับ position keyword filter (keyword, group_label) |
| `industry_group` | mapping industry → group |
| `country` | mapping country → region |
| `v2_search_sessions` | session ของ AI Assistant (stage 1–3 pipeline เก่า) |
| `v2_search_results` | ผลลัพธ์จาก stage 1 pipeline เก่า |
| `import_gm_hotel_list` | list GM hotel ที่ import เข้ามา (925 คน, ใช้สำหรับ data audit) |

---

## Supabase RPC Functions (สร้างแล้ว)

| Function | ทำอะไร |
|---|---|
| `search_candidate_ids(p_*)` | รับ filter params → return candidate_ids ที่ตรงเงื่อนไข |
| `get_cascading_options(p_*)` | return available options สำหรับแต่ละ filter field (exclude-self pattern) |
| `get_search_summary(p_*)` | return `{total, current, companies}` scoped ตาม filter |

Filter params ทั้งหมด: `p_position_keywords[], p_position_levels[], p_positions[], p_companies[], p_countries[], p_regions[], p_hotel_ratings[], p_industry_group, p_industries[], p_current_only, p_job_functions[]`

Logic: `cardinality(array) = 0` = ไม่ filter field นั้น, LEFT JOIN country + company_master + Candidate Profile

---

## หน้าหลักของระบบ

| Route | ชื่อหน้า | สถานะ |
|---|---|---|
| `/` | Overview | มีแล้ว |
| `/pending-tasks` | Pending Task for Recruiter | มีแล้ว |
| `/dashboard` | Dashboard (KPI, Search & Placement, Recruiter Performance) | มีแล้ว |
| `/candidates` | Candidate Explorer | มีแล้ว — มีระบบ select + Add to JR |
| `/requisitions` | Job Requisitions | มีแล้ว |
| `/org-chart` | Org Chart | มีแล้ว (มี bugs) |
| `/ai-search` | AI Power Search | มีแล้ว |
| `/assistant` | AI Primary Search (chat) | มีแล้ว — Stage 1–3.5 pipeline |
| `/ai-search-v2` | AI Power Search V2 | มีแล้ว |
| `/ai-search-demo` | AI Search Demo | **กำลังสร้าง** — focus ใหม่ |
| `/settings` | Settings | มีแล้ว |
| `/admin/n8n` | n8n Integration | มีแล้ว |
| `/admin/companies` | Company Master | มีแล้ว |
| `/reports/aging` | Data Aging Report | มีแล้ว |

---

## AI Search Demo — ทำอะไรไปแล้ว (/ai-search-demo)

### Files
- `src/app/ai-search-demo/page.tsx` — main page (client component)
- `src/app/ai-search-demo/FilterPanel.tsx` — filter panel 11 sections
- `src/app/ai-search-demo/SuggestedFilters.tsx` — suggestion chips ใต้ filter panel
- `src/app/ai-search-demo/types.ts` — DemoFilterState, EMPTY_FILTERS, POSITION_LEVELS, HOTEL_RATINGS, AiParseResult
- `src/app/actions/ai-search-demo.ts` — server actions ทั้งหมด

### Features ที่ทำแล้ว
- Filter Panel 11 sections: Position Keywords, Position Level, Industry Group, Industry, Region, Country, Hotel Rating, Current Job Only, Job Function, Position (actual), Company
- Cascading filters — ทุก filter affect กันด้วย RPC (exclude-self pattern), debounced 500ms
- Manual Search button — กด Search ถึงจะ run query (ไม่ auto)
- Pagination 20 per page — store allCandidateIds, slice per page
- Summary Cards: Total Found, Currently in Role, Past Role, Companies
- AI Query Input — พิมพ์ NL → Claude Haiku แปลงเป็น filter JSON อัตโนมัติ
- Suggested Filters — AI suggest expansion chips ใต้ filter panel (แยกหมวด, 3 อันแรก + more...)

### Architecture ของ AI Parse
```typescript
// AI returns:
{
  filters: Partial<DemoFilterState>,      // สิ่งที่ user บอกชัดเจน
  suggestions: Partial<DemoFilterState>   // สิ่งที่ AI แนะนำให้ expand
}
```

### ยังต้องทำ
- ปุ่ม "ประเมิน Stage 2 & 3" — ยังไม่ได้ wire (รอ product decision ว่าจะ flow แบบไหน)

---

## JR Flow (Add to Job Requisition)

### ไฟล์ที่เกี่ยวข้อง
- `src/components/ai-search/AddCandidateDialog.tsx` — Sheet/Modal เลือก JR หรือสร้างใหม่
- `src/app/actions/jr-candidates.ts` — `bulkAddCandidatesToJR()`, `bulkAddByFilterToJR()`

### Flow
1. เลือก candidates → กด "Add to JR"
2. เลือก existing JR หรือ Create New JR
3. Insert เข้า `jr_candidates` (status='Pool Candidate') + `status_log`
4. Recruiter ทำงานต่อใน JR: interview, rank, top profile, placement

### Validation
- Blacklist check (candidate_status = 'Blacklist' → blocked)
- Duplicate check (already in JR → skip)
- Initial status = 'Pool Candidate', list_type = 'Longlist' หรือ 'Top Profile'

---

## Data Quality Issues (ที่รู้แล้ว)

- `company_master.rating = null` สำหรับ 1,087 บริษัท (industry='Wait AI Check')
  → filter hotel_rating จะพลาดคนเหล่านี้ → แผน: ใช้ n8n classify
- `candidate_experiences.country = null/Unknown/N/A` ประมาณ ~160 คน
- `candidate_experiences.position_keyword = null` ~238 คน (จาก import_gm_hotel_list)

---

## Environment & Tech

- **Supabase Project**: ddeqeaicjyrevqdognbn (service role key ใช้ admin client)
- **AI Model**: Claude Haiku 4.5 สำหรับ AI Search parsing (fast + cheap)
- **n8n**: ใช้สำหรับ Stage 2–3.5 pipeline (webhook-based)
- **Dev server**: `npm run dev` → localhost:3000

---

## Sub-system References

ไฟล์เหล่านี้คือ **งานที่ยังทำไม่เสร็จและต้อง follow up ต่อ** — อ่านก่อนทุกครั้งที่จะพัฒนาส่วนที่เกี่ยวข้อง เพื่อไม่สร้างซ้ำและทำต่อได้ถูกจุด

@docs/hotel_chain_system.md
@docs/country_location_system.md
