# CG Talent Hub ATS — สถานะระบบปัจจุบัน (Phase 1–2) และเป้าหมายถัดไป

> สรุปเมื่อ 2026-10-27 จากโค้ดใน repo + docs + คำอธิบายของเจ้าของระบบ
> ส่วนที่ "รันบน n8n server" ผมเห็นแค่ฝั่ง Next.js ที่เรียก webhook ไม่ได้เห็น workflow จริง — ระบุไว้เป็น (n8n) ทุกจุด
> GitHub: https://github.com/cgtalenthubats-exe/CGTalentHub_ATS

## 0. กรอบ Phase

| Phase | ความหมาย | สถานะ |
|---|---|---|
| **1 — Foundation** | สร้างระบบ database ใหม่ จัดข้อมูลให้เป็นระเบียบ สร้างความเชื่อมโยงระหว่างข้อมูล เพื่อให้ AI ต่อยอดได้ | ✅ ทำแล้ว (ยังมีงานเก็บตก ดูข้อ 7) |
| **2 — Automation, Logic, AI Agents** | ใส่ automation, business logic และ AI agent หลายจุด | ✅ ทำแล้วหลายจุด (ดูข้อ 3–6) |
| **3–5** | ยังไม่เริ่ม | ⏳ |
| **เป้าหมายปลายทาง** | HR system ที่ AI เป็นตัว drive แบบ full autonomous | 🎯 |

---

## 1. สถาปัตยกรรมโดยรวม — ใช้อะไร ทำอะไร ตรงไหน

| ชั้น | เทคโนโลยี | หน้าที่ |
|---|---|---|
| Frontend + Backend | Next.js 15 (App Router, Server Actions), React 19, TypeScript, Tailwind + Radix UI | UI ทั้งหมด, server actions เรียก DB / เรียก n8n / เรียก LLM |
| Database | Supabase Postgres (+ RLS, RPC, pg_trgm), Supabase Auth, Storage | เก็บข้อมูลทั้งหมด, logic ค้นหาอยู่ใน RPC |
| Vector | Supabase B (แยกโปรเจค) + Vertex `text-embedding-005` | vector ranking ผ่าน RPC `rank_candidates_by_vector` (เรียกจาก n8n เท่านั้น) |
| Orchestration | **n8n** (self-host บน Hostinger) | งาน AI/automation ที่ยาวหรือหลายขั้นตอน |
| LLM | Claude Haiku 4.5 (parse query เป็น filter, เรียกตรงจาก Next.js) · Gemini (parse text, vision, chat agent, ประเมินรายคน) · Claude Sonnet (สรุปและจัดอันดับ — ตาม docs) | |
| Agent loop ใน Next.js | Vercel AI SDK (`/assistant`) | tool-use หลายรอบ |
| Output | pptxgenjs, pdfkit, sharp, Gmail API | สร้างและส่งเอกสาร |

---

## 2. Phase 1 — Foundation (ข้อมูลและโครงสร้าง)

### 2.1 ตารางหลัก
`Candidate Profile` · `candidate_experiences` · `company_master` + `company_variation` · `hotel_chain_master` · `job_requisitions` · `jr_candidates` · `status_log` · `status_master` · `employment_record` · `position_keyword_vocab` · `industry_group` · `country` · `ai_ranking_jobs/results` · `v2_search_sessions/results` · `n8n_configs` · `n8n_chat_histories` · `resume_uploads` · `jr_reports` · `pre_screen_log` · org chart tables

### 2.2 การทำข้อมูลให้ consistent
| งาน | ผลที่ได้ |
|---|---|
| Company master + variation | ชื่อบริษัทหลายแบบ → `company_id` เดียว |
| Hotel chain | 92 chains / 399 sub-brands + star rating, map แล้ว 1,282 บริษัท, มี admin UI (`HotelChainMappingTab`) |
| Position keyword | rule-based SQL + AI batch (n8n) → ~88.8% mapped ตอนวัด |
| Industry / group / job function | controlled vocab, จัดหมวด candidate ตามสายงาน, company ตาม industry |
| Country | แยก work country (มี note แหล่งที่มา) กับ current residence; parse จาก full_address 3,030 rows |
| Age / date | recalc age จาก date of birth, util จัดการ date หลาย format |
| Compensation fields | แยก salary/bonus/allowance/provident/insurance/อื่นๆ |
| Duplicate check | normalize ชื่อ/อีเมล/LinkedIn ก่อนสร้าง candidate และตอน import |
| Data aging | หน้า `/reports/aging` นับอายุข้อมูล |
| RPC layer | `search_candidate_ids`, `get_cascading_options`, `get_search_summary`, `get_company_chain_info`, population/analytics, `fill_position_keywords` |
| Migrations | versioned ใน `supabase/migrations` |

---

## 3. Pipeline (JR → Placement)

**Flow:** สร้าง JR → เพิ่ม candidate (bulk / by-filter / จาก AI search) → `Pool Candidate` → Longlist / Top Profile → Interview → Offer → Placement / Resignation

| ส่วน | ทำอะไร | ไฟล์หลัก |
|---|---|---|
| JR management | สร้าง/แก้/copy JR, JD upload (เก็บเป็น PDF), JR notes, head-recruit notes | `requisitions.ts`, `copy-jr-dialog.tsx`, `lib/jd-pdf.ts` |
| หน้า JR Manage | 6 tab: List · Kanban · History · Activity (Transaction / Aging) · **Salary** · **AI Suggestion** | `requisitions/manage/page.tsx` |
| Add to JR | validation: block blacklist, ข้ามคนซ้ำใน JR, log ลง `status_log` | `jr-candidates.ts` |
| Status engine | เปลี่ยนสถานะทีละคน/batch, status ถูก derive จาก `status_log`, สีและลำดับกำหนดใน `status_master` | `status-updates.ts`, `status-master.ts` |
| **Stage Aging** | วัดว่าใครค้าง stage ไหนนาน: ระดับ ok / attention (7 วัน) / delayed (14) / critical (21), แยก "ที่รอมา" กับ "ระยะเวลาที่ stage นั้นใช้จริง (median)", ระบุ owner (TA / Hiring Team / Candidate) | `lib/stage-aging.ts`, `jr-stage-aging.ts`, `StageAgingPanel.tsx` |
| Pending Tasks | JR ที่ต้องทำต่อ, JR maintenance board, refresh candidates | `pending-tasks/` |
| Interview / Pre-screen | feedback + rating + ไฟล์แนบ, pre-screen log, KPI card, export Excel | `interview-feedback.ts`, `pre-screen-actions.ts` |
| Placement / Resignation | confirm/edit placement, resignation, employment record, placement report | `placement*.ts`, `requisitions/placements`, `resignations` |
| Dashboard / KPI | KPI, Search & Placement funnel, recruiter performance, population/gender breakdown | `dashboard/`, `kpi-actions.ts`, `analytics.ts` |
| Notifications | NotificationCenter | `components/NotificationCenter.tsx` |

---

## 4. Salary Benchmark

**ใช้ที่ไหน:** tab "Salary" ใน JR Manage (`SalaryBenchmarkTab.tsx`, `jr-salary-benchmark.ts`, `lib/salary-stats.ts`)

- เทียบ **budget ของ JR (min/max/note)** กับเงินเดือนของ candidate ที่อยู่ใน JR นั้นจริง
- แสดง: สถิติของ pool, histogram, **percentile ของ budget**, budget เทียบ median (%), แยกตาม **star rating / industry / region**, ตารางรายคน (รวมคนที่ยังไม่มีเงินเดือน เพื่อให้เห็นว่าข้อมูลขาด)
- หน่วย: เงินเดือนพื้นฐานรายเดือน (THB) จาก `gross_salary_base_b_mth`, โบนัสแสดงแยกเป็นจำนวนเดือน ไม่รวมเข้าเงินเดือน
- อ้างอิง "ที่เราเคยจ่ายจริง" จาก `employment_record`
- **ขอบเขต (ตั้งใจ):** ใช้เฉพาะ candidate ใน JR ไม่ใช่ทั้ง DB, ใช้ข้อมูลภายใน ไม่ใช่ market survey (Mercer/Hays) และหน้าจอระบุชัดว่า internal data
- มี market salary view แยกอยู่ใน Dashboard (`getMarketSalaryStats`) ตามบริษัท/industry/job family
- ต้องรัน migration `20260916000000_add_jr_budget_and_stage_owner.sql` (เพิ่ม budget และ owner_role) — migration นี้อยู่ใน repo แล้ว ควรยืนยันว่ารันบน production แล้ว

---

## 5. n8n ใช้ส่วนงานไหนบ้าง

เรียกจาก Next.js (ตัวเลขใน () คือชื่อ config/webhook ที่เห็นในโค้ด)

| งาน | n8n ทำอะไร | จุดที่เรียก |
|---|---|---|
| **Resume parsing** | ดึงคิว `resume_uploads` ทีละ 5 ไฟล์ → parse → callback เข้า `/api/n8n/callback` (กัน duplicate ก่อนสร้าง candidate) | `api/n8n/queue`, `api/n8n/callback` |
| **CSV upload** (`CSV Upload`) | ประมวลผลไฟล์ import | `csv-actions.ts` |
| **JD upload** (`Job Description Upload`) | ส่ง JD ที่สร้าง/แก้ให้ workflow ประมวลผล | `triggerJRWebhook` |
| **Candidate refresh** (`Candidate Refresh`) | refresh ข้อมูล candidate ตามรายชื่อที่เลือก (ส่ง id, name, linkedin ไปให้ workflow — รายละเอียดการ refresh อยู่ฝั่ง n8n) | `triggerCandidateRefresh` |
| **JR Report** (`JR Report`) | สร้างรายงาน JR, log สถานะใน `jr_reports` | `triggerReport` |
| **Org chart** (`OrgChart Workflow`) | ประมวลผล org chart + callback กลับ `/api/n8n/org-chart/callback` | `org-chart-actions.ts` |
| **Candidate Search** (`Candidate Search`) | search job รุ่น `/ai-search` | `ai-search.ts` |
| **AI Search V3 chat** (`/webhook/<id>`, `ai_search_chat`) | Main agent + sub-agent (SQL ผ่าน MCP, web search, vector rank, categorize) | `ai-search-v3-chat.ts`, `api/ai-search-chat` |
| **Vector rank — Stage 2** (`/webhook/vector-rank`) | embed JD → ranking top 20 → สร้าง session → trigger Stage 3 | `ai-search-ranking.ts`, `ai-search-v3/page.tsx` |
| **Stage 3 assessment — หน้า Search** (`/webhook/search-stage3`, `demo-stage3`) | ประเมิน 4 มิติรายคน + สรุปจัดอันดับ | `ai-search-ranking.ts`, `ai-ranking.ts` |
| **Stage 3 assessment — JR Manage** (`/webhook/jr-assess`) | ประเมิน candidate ใน JR จาก JD | `triggerStage3Ranking` |
| **JR AI chat** (`/webhook/jr-ai-chat`) | แชทผูกกับ JR มี memory ต่อ JR (`n8n_chat_histories`) | `jr-ai-chat.ts` |
| **Chat assistants รุ่นเก่า** (`chat_assistant`, `v2_chat_assistant`) | แชท assistant รุ่นก่อน V3 | `api/chat`, `api/v2/chat` |
| **Data cleansing แบบ batch** | วนลูปส่ง AI เติม position_keyword และ industry ของ company | `docs/n8n_ai_batch_prompts.md` |

จัดการ URL ได้จากหน้า `/admin/n8n` (เก็บใน `n8n_configs` ไม่ต้อง deploy ใหม่) แต่ webhook ของ ranking/vector/jr-assess/jr-ai-chat ยัง hard-code ใน server actions (บางตัวมี env override)

---

## 6. AI / Agent ที่ทำงานอยู่ (Phase 2)

| ส่วน | ระดับ | รายละเอียด |
|---|---|---|
| NL → filter (`/ai-search-demo`) | LLM call เดียว | Claude Haiku 4.5 แปลงภาษาธรรมชาติเป็น filter + suggestion chips |
| AI Search V3 chat | Agent (n8n) | **ใช้งานจริง** ทั้งหน้า AI Search และ JR Manage: brainstorm + AI Assessment |
| `/assistant` | Agent loop ใน Next.js | tool `searchCandidates`, `setFilters`, `getAnalytics` |
| JR AI chat | Agent (n8n) + memory ต่อ JR | |
| Vector → Stage 3 | Workflow กำหนดขั้นตอนตายตัว | คุม cost ให้ LLM ประเมินแค่ Top 20 |
| Parsing (resume, text, org chart image) | LLM extraction | Gemini |
| Document generation | โค้ดกำหนด layout | PPTX short profile/longlist/assessment/org chart, JD PDF, ส่ง Gmail |

**ข้อสังเกต:** agent ทั้งหมดตอนนี้ "อ่านและเสนอ" เป็นหลัก การเปลี่ยนสถานะ ส่งอีเมล สร้าง JR ยังเป็นคนกดเอง

---

## 7. งานเก็บตกจาก Phase 1–2 (ก่อนเริ่ม Phase 3)

จาก docs ใน repo (ยืนยันสถานะปัจจุบันกับทีมอีกที):
- Hotel chain: ยังไม่ map อีก ~16,892 บริษัท, parent company backlog, chain counts ยังไม่ dynamic, sub-brand ไม่มี count
- Hotel chain mapping UI: spec ใน `hotel_chain_system.md` (บางส่วนมี `HotelChainMappingTab` แล้ว)
- Data freshness: branch แก้ stale data หลังบันทึก ยังไม่ merge (ตาม doc ณ 2026-09-16)
- Compensation fields / Salary Benchmark / Stage Aging: อยู่ใน branch แยกตาม doc ต้องยืนยันว่า merge และรัน migration แล้ว
- `docs/ai-search-v3-plan.md` ยังเขียนสถานะเก่า (V3 ใช้งานจริงแล้ว) ควรอัปเดต
- ไม่มี automated test (มีแค่ lint) — จำเป็นก่อนให้ AI ลงมือทำเองมากขึ้น
- Resume parser ฝั่ง n8n ยังไม่มี metric ความแม่นยำที่บันทึกไว้

---

## 8. ช่องว่างระหว่างตอนนี้ กับ "Full Autonomous HR"

| ความสามารถ | ตอนนี้ | ต้องมีเพิ่ม |
|---|---|---|
| รับรู้ (อ่านข้อมูล, ค้น, วิเคราะห์) | ✅ | — |
| ตัดสินใจเสนอ (ranking, assessment) | ✅ | feedback loop ให้ AI เรียนจากการตัดสินใจของคน |
| ลงมือทำ (เปลี่ยนสถานะ, ส่งข้อความ, นัดหมาย) | ❌ | tool แบบ write + approval gate + audit |
| ทำงานเชิงรุก (ตื่นเองตามเวลา/เหตุการณ์) | บางส่วน (cron ใน n8n) | agent ที่ถือเป้าหมายต่อเนื่อง |
| Memory ระยะยาว | เฉพาะ chat ต่อ JR | preference ของ recruiter/ลูกค้า |
| Guardrail / Eval / Observability | ❌ | วัดคุณภาพ, trace tool call, ขีดจำกัดสิทธิ์ |
| Test ที่เชื่อถือได้ | ❌ | จำเป็นก่อนให้ AI แก้/สั่งงานจริง |
| Integration ภายนอก | Gmail | calendar, messaging (LINE/Slack), HRIS/payroll |
