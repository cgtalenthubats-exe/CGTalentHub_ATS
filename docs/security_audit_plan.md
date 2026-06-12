# Security Audit Plan — CGTalentHub ATS

> **สถานะ: 📋 PLANNING** — ยังไม่ได้แก้อะไรจริง เอกสารนี้คือ audit plan + checklist
> สร้างจาก: Supabase security advisors (`get_advisors`, project `ddeqeaicjyrevqdognbn`) + code survey ของ `src/`
> อ่านไฟล์นี้ก่อนเริ่มแก้ security issue ใดๆ — เพื่อไม่ทำซ้ำและรู้ priority

---

## Context

ระบบใช้ Supabase โดยมี client สามแบบ:
- **Browser/anon client** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) — ฝังอยู่ใน browser bundle ทุกคนเห็นได้
- **Server/SSR client** (anon key + cookies) — ใช้ใน server actions ทั่วไป, ผ่าน middleware whitelist check
- **Admin client** (`SUPABASE_SERVICE_ROLE_KEY`) — bypass RLS ทั้งหมด ใช้เฉพาะ server-side (14+ ไฟล์ใน `src/app/actions/*` และ `src/app/api/**`)

**ประเด็นหลัก:** anon key เป็น public credential — ความปลอดภัยของข้อมูลทั้งหมดขึ้นอยู่กับ **RLS policy** บนตารางใน `public` schema และ **storage bucket policy** เท่านั้น ไม่ใช่ middleware (เพราะ middleware ไม่ได้ป้องกัน direct REST API call ไปที่ Supabase)

---

## 🔴 Phase 0 — Critical (exploitable ตอนนี้ ทำก่อนทุกอย่าง)

### 0.1 RLS ปิดอยู่บน 57 ตารางใน `public` schema

**ผลกระทบ:** ใครก็ตามที่มี anon key (อยู่ใน browser bundle) ยิง Supabase REST API ตรง (`https://ddeqeaicjyrevqdognbn.supabase.co/rest/v1/<table>?select=*`) อ่าน/เขียนตารางพวกนี้ได้ทันที โดย **ไม่ผ่าน middleware, ไม่ผ่าน login เลย**

ตารางที่มี PII / ข้อมูล sensitive (priority สูงสุด):

| ตาราง | เหตุผล |
|---|---|
| `Candidate Profile` | ข้อมูลหลัก candidate ทั้งหมด — ชื่อ, เบอร์, photo |
| `Candidate Profile_BackUp 9 Mar 2026` | สำเนา PII เดียวกัน |
| `candidate_experiences`, `candidate_experiences_duplicate`, `candidate_experiences_date_backup_20260528`, `candidate_experiences_industry_issue`, `_backup_candidate_experiences_20260416` | ประวัติการทำงาน |
| `candidate_profile_enhance` | LinkedIn full_address, current location |
| `employment_record` | ประวัติการจ้างงาน |
| `interview_feedback`, `interview_feedback_backup` | feedback การสัมภาษณ์ (มี comment ส่วนตัว) |
| `job_requisitions`, `jr_candidates`, `jr_reports`, `All_candidate_JR` | ข้อมูล JR + candidate pipeline |
| `status_log`, `pre_screen_log` | audit trail |
| `resume_uploads`, `csv_upload_logs` | metadata ไฟล์ resume |
| `internal_cfo_central`, `internal_candidate_group` | ข้อมูล internal candidate |
| `n8n_configs` | webhook URL, AI API key config |
| `app_settings` | app-wide config |
| `ai_search_sessions`, `ai_search_jobs`, `ai_search_results`, `v2_search_sessions`, `v2_search_results`, `v2_pipeline_status`, `v2_chat_messages`, `n8n_chat_histories` | session/chat history (มี `session_id` ที่ flag เป็น sensitive ด้วย) |

ตารางที่เหลือ (reference/staging/backup, priority รองลงมาแต่ก็ควรปิด):

```
candidate_status_master, company_cleaning_staging, country_cleansing_stage,
company_variation, country, status_master, nationality, resignation_reason_master,
company_master, candidate_audit_staging, temp_linkedin_import, industry_issue,
industry_issue_detailed, import_gm_hotel_list, import_gm_hotel_list_v2,
import_gm_hotel_centara_sala, hotel_chain_master, hotel_group,
position_keyword_vocab, ai_ranking_jobs, ai_ranking_results,
encoding_correction_staging, temp_candidate_fix,
_backup_company_master_20260416, _backup_company_variation_20260416
```

**แนวทางแก้:** เปิด `ENABLE ROW LEVEL SECURITY` ทุกตาราง + เขียน policy แบบ "authenticated only" เป็น default ก่อน (`USING (auth.role() = 'authenticated')`) — เพราะ server actions ใช้ service role อยู่แล้ว (bypass RLS) ไม่กระทบ flow หลัก แต่ต้อง**สำรวจก่อนว่ามีหน้าไหนใช้ anon client query ตารางพวกนี้ตรงๆ** (ไม่ผ่าน RPC/server action) — ถ้ามีต้อง whitelist เฉพาะ column/operation ที่จำเป็น

### 0.2 Storage buckets เปิด public + allow listing

| Bucket | Policy ปัจจุบัน | ความเสี่ยง |
|---|---|---|
| `resumes` | `Public Select` — ใครก็ list ไฟล์ทั้ง bucket ได้ | resume PDF ของผู้สมัครทุกคนโหลดได้หมด |
| `org_charts` | `Public Access Org Charts` | org chart ภายในบริษัทลูกค้าหลุด |
| `avatars` | `Public Select Avatars` | รูปโปรไฟล์หลุด (ความเสี่ยงต่ำกว่า) |

**แนวทางแก้:** เปลี่ยนเป็น signed URL หรือจำกัด policy ให้ต้อง `authenticated` + (ถ้าเป็นไปได้) scope ตาม path/owner

### 0.3 `user_profiles` — policy `USING (true)` สำหรับ authenticated

ตาราง whitelist ที่ middleware ใช้เช็คสิทธิ์เข้าระบบ — ตอนนี้ user ที่ login แล้ว (อยู่ใน whitelist) **อ่าน/แก้/ลบ row ของคนอื่นได้หมด** เช่น แก้ email ตัวเองให้ตรงกับ record ของ admin, หรือลบคนอื่นออกจาก whitelist

**แนวทางแก้:** policy ใหม่ — user แก้ได้แค่ row ที่ `email = auth.email()` ของตัวเอง, การเพิ่ม/ลบ whitelist ต้องผ่าน admin client เท่านั้น

---

## 🟠 Phase 1 — Authentication & Authorization (app layer)

| # | ประเด็น | ตำแหน่ง | แนวทางแก้ |
|---|---|---|---|
| 1.1 | Middleware ยกเว้น `/api/*` ทั้งหมด ไม่มี auth check เลย | `src/middleware.ts:44` | เพิ่ม auth check สำหรับ API routes ที่ sensitive (`/api/candidates/*`, `/api/ai/*`) — อย่างน้อย require session cookie |
| 1.2 | `/api/n8n/callback`, `/api/n8n/org-chart/callback` รับ POST จากใครก็ได้ แล้ว insert เข้า DB ด้วย service role | `src/app/api/n8n/callback/route.ts`, `src/app/api/n8n/org-chart/callback/route.ts` | เพิ่ม shared secret header validation (เทียบ env var `N8N_CALLBACK_SECRET`) |
| 1.3 | `/api/n8n/queue` — `CRON_SECRET` bearer check ถูก comment ไว้ | `src/app/api/n8n/queue/route.ts` | เปิด check กลับ + ตั้งค่า `CRON_SECRET` ใน env |
| 1.4 | `/api/debug` เปิด public, leak env var presence | `src/app/api/debug/route.ts` | ลบ route นี้ หรือ gate ด้วย auth + non-production only |
| 1.5 | `/admin/companies`, `/admin/n8n` ไม่มี role check — ใครใน whitelist เข้าได้หมด | `src/app/admin/**` | เพิ่ม column `role`/`is_admin` ใน `user_profiles` + เช็คใน middleware หรือ layout ของ `/admin` |
| 1.6 | Supabase Auth: Leaked password protection ปิดอยู่ | Supabase Dashboard → Auth settings | เปิด feature นี้ (ฟรี, ไม่กระทบ flow) |

---

## 🟡 Phase 2 — RLS Policy Hardening (ตารางที่เปิด RLS แล้วแต่ policy หลวม/ขาด)

### 2.1 Policy `USING (true)` ครอบ ALL operations (13 ตาราง)

```
all_org_nodes (Public Nodes Access)
candidate_experiences_gap (Enable all access)
candidate_matching_audit (Allow all for authenticated users)
consolidated_results (Enable all access for authenticated users)
ext_candidate_experiences (Enable all access for authenticated users)
ext_candidate_profile (Enable all access for authenticated users)
ext_profile_enhance (Enable all access for authenticated users)
org_chart_profile_staging (Public Staging Access)
org_chart_uploads (Public Uploads Access)
search_job_status (Enable all access for authenticated users)
search_jobs (Enable all access for authenticated users)
test_encoding_logs (Allow all for testing)
user_profiles (Allow all access for authenticated users) — ดู Phase 0.3
```

→ Review แต่ละตัว: ถ้าเป็น internal/staging table ที่ client ไม่เคย query ตรง → ลด scope เป็น service-role only (RLS ปิดให้ anon/authenticated ทั้งหมด) แทนการเปิด `true`

### 2.2 SECURITY DEFINER views (6 ตัว) — verify ไม่ leak ข้าม RLS

```
vw_candidate_job_grouping_distribution
vw_candidate_group_distribution
vw_candidate_industry_distribution
vw_candidate_job_function_distribution
v_hotel_chain_master
company_stats_view
```

### 2.3 SECURITY DEFINER function ที่ anon/authenticated เรียกได้

`sync_candidate_status_from_employment` — เช็คว่าทำอะไร, ถ้าไม่จำเป็นต้องให้ anon เรียก → `REVOKE EXECUTE FROM anon, authenticated`

### 2.4 RLS เปิดแล้วแต่ไม่มี policy เลย (6 ตาราง — เท่ากับ deny-all ปัจจุบัน)

```
company_reference_location, company_set_group, industry_group,
linkedin_industry_id, merge_pairs, unique_location_name
```

→ เช็คว่ามี flow ที่ broken จากการนี้หรือไม่ (เช่น cascading filter queries) — ถ้าใช้ผ่าน service role อยู่แล้วไม่ต้องแก้

---

## 🟢 Phase 3 — DB Hygiene (priority ต่ำ, ทำเป็น batch ได้)

- **`function_search_path_mutable`** — 42 functions ไม่ set `search_path` → fix ด้วย `ALTER FUNCTION ... SET search_path = ''` เป็น batch script
- **`extension_in_public`** — `vector`, `unaccent` อยู่ใน `public` schema → ย้ายไป schema `extensions`

---

## 🔵 Phase 4 — Application Layer

| # | ประเด็น | รายละเอียด |
|---|---|---|
| 4.1 | File upload ไม่จำกัด size / validate type หลวม | resume (PDF only แต่ไม่เช็ค size), org chart (รับหลาย format), JR/feedback attachment (ไม่ validate เลย) |
| 4.2 | ไม่มี rate limiting / CSRF protection บน API routes | โดยเฉพาะ `/api/ai/*` ที่เรียก external AI API — เสี่ยง cost abuse |
| 4.3 | Google AI API key เก็บใน `n8n_configs` table | ซ้ำกับ Phase 0.1 — ถ้าตารางนี้เปิด RLS แล้วปัญหานี้ลดลงเยอะ แต่ควร consider Supabase Vault สำหรับ secret ระยะยาว |
| 4.4 | `npm audit` — ยังไม่ได้รัน | เช็ค dependency vulnerabilities |

---

## Execution Order & Status

| Step | งาน | Effort | Status |
|---|---|---|---|
| 1 | เปิด RLS + policy "authenticated only" สำหรับตาราง PII หลัก (Phase 0.1 กลุ่มแรก) | กลาง-สูง (ต้อง survey anon-client usage ก่อน) | ⬜ Not started |
| 2 | เปิด RLS สำหรับตาราง staging/backup ที่เหลือ (Phase 0.1 กลุ่มสอง) | ต่ำ | ⬜ Not started |
| 3 | แก้ storage bucket policy (Phase 0.2) | ต่ำ | ⬜ Not started |
| 4 | แก้ `user_profiles` policy (Phase 0.3) | ต่ำ | ⬜ Not started |
| 5 | เพิ่ม secret validation ให้ n8n callbacks + เปิด CRON_SECRET check (Phase 1.2, 1.3) | ต่ำ-กลาง | ⬜ Not started |
| 6 | ลบ/gate `/api/debug` (Phase 1.4) | ต่ำ | ⬜ Not started |
| 7 | เพิ่ม auth check ใน middleware สำหรับ sensitive API routes (Phase 1.1) | กลาง | ⬜ Not started |
| 8 | เพิ่ม role-based gate สำหรับ `/admin/*` (Phase 1.5) | ต่ำ-กลาง | ⬜ Not started |
| 9 | เปิด Leaked Password Protection (Phase 1.6) | ต่ำ (dashboard setting) | ⬜ Not started |
| 10 | Review Phase 2 (RLS policy หลวม, security definer views/functions) | กลาง | ⬜ Not started |
| 11 | Phase 3 (search_path, extensions) — batch script | ต่ำ | ⬜ Not started |
| 12 | Phase 4 (upload limits, rate limit, npm audit) | กลาง | ⬜ Not started |

---

## Pre-work ที่ต้องทำก่อน Step 1 (สำคัญ)

ก่อนเปิด RLS บนตาราง PII ต้อง **survey ว่าหน้าไหนใน frontend ใช้ anon/browser client (`src/lib/supabase/client.ts`, `src/utils/supabase/client.ts`) query ตารางพวกนี้ตรงๆ** (`.from('Candidate Profile')`, `.from('candidate_experiences')` ฯลฯ) โดยไม่ผ่าน server action/RPC — ถ้ามี การเปิด RLS จะทำหน้านั้น "เห็นข้อมูลว่าง" ทันที (ไม่ error แต่ data หาย เพราะ default-deny)

ส่วนใหญ่ของระบบ (server actions ใช้ admin client) ไม่ควรกระทบ — แต่ client component ที่ fetch แบบ realtime/subscribe (เช่น org chart realtime refresh ที่เห็นใน v2) อาจใช้ anon client โดยตรง ต้องเช็คเป็นรายตัว

---

*สร้างเมื่อ: 2026-06-12 | Security Audit Plan v1 — สถานะ Planning, ยังไม่ลงมือแก้*
