# CG Talent Hub ATS — Project Overview (สำหรับทำ Pitch Deck)

> เอกสารนี้สรุปจากโค้ดและ docs จริงใน repo (ณ 2026-10-01) เพื่อใช้เป็น input ทำ PPTX
> GitHub: https://github.com/cgtalenthubats-exe/CGTalentHub_ATS
> ประวัติ: 81 commits (ก.ค.–ก.ย. 2026), Next.js 15 + React 19 + TypeScript, Supabase (Postgres), n8n, LLM หลายค่าย

---

## 1. One-liner / Positioning

**"ATS ที่ AI ทำงานส่วนใหญ่ให้หมด — ตั้งแต่อ่านเอกสาร ค้นหา คัดกรอง จัดอันดับ ไปจนถึงสร้างรายงานพร้อมส่งลูกค้า — คนเหลือแค่ review แล้วเอาไปใช้ต่อ"**

สร้างสำหรับ headhunting ในสาย Hospitality (โรงแรม, F&B, Luxury) ที่ข้อมูลซับซ้อน: chain/sub-brand/star rating, ตำแหน่งระดับ GM/C-Level, ผู้สมัครย้ายประเทศบ่อย แต่ pattern นี้ใช้ซ้ำกับ vertical อื่นได้ (ดูข้อ 9)

**ปัญหาที่แก้**
- Recruiter เสียเวลากับงานซ้ำ: คีย์ข้อมูลจาก resume, ไล่ค้นหาใน DB, อ่านโปรไฟล์ทีละคน, ทำสไลด์ส่งลูกค้า
- ข้อมูลสกปรก (ชื่อบริษัทหลายแบบ, ตำแหน่งไม่ standardize, ประเทศเดาจาก HQ) ทำให้ค้นหาไม่แม่น
- AI search ทั่วไปแพงและไม่น่าเชื่อถือถ้าโยนทุกคนให้ LLM อ่าน

---

## 2. System Architecture (ภาพรวม)

```
 ┌────────────── Next.js 15 (App Router, Server Actions) ──────────────┐
 │  Recruiter UI: Candidates · JR · AI Search · Assistant · Org Chart  │
 │  Dashboard · Pending Tasks · Placement · Reports · Admin            │
 └───────┬──────────────────┬───────────────────────┬──────────────────┘
         │ SQL / RPC        │ webhook + polling      │ direct LLM call
         ▼                  ▼                        ▼
   Supabase Postgres     n8n workflows           Claude Haiku 4.5 (filter parse)
   (RLS, RPC, trgm,      (long-running AI        Gemini (chat agent, vision,
    vector search)        jobs, queue, cron)      resume parse, per-candidate eval)
                                                  Claude Sonnet (summary & rank)
                                                  Vertex text-embedding-005
```

หลักคิด: **งานเร็ว/ถูก** (SQL, filter) ทำใน Next.js + Postgres RPC · **งาน AI หนัก/ใช้เวลานาน** ทำใน n8n แบบ async แล้ว poll ผลกลับมาแสดงแบบ progressive

---

## 3. Feature Pillars (จุดขายหลัก)

### Pillar 1 — Document Parsing & Ingestion
| Capability | รายละเอียดที่มีจริง | ไฟล์หลัก |
|---|---|---|
| Resume upload → queue → parse | อัปโหลด PDF/resume เข้า storage, กัน duplicate ตามชื่อไฟล์, สถานะ pending/Error, n8n ดึงคิวทีละ 5 ไฟล์แล้ว callback กลับ | `ResumeUpload.tsx`, `actions/resume-actions.ts`, `api/n8n/queue`, `api/n8n/callback` |
| Paste text → structured profile | วางข้อความดิบ (LinkedIn/CV) → Gemini แปลงเป็น JSON profile ตาม prompt ที่แก้ได้จากหน้า Settings (ไม่ต้อง deploy) | `api/ai/parse-candidate` |
| **Org chart image/PDF → org tree** | อัปโหลดรูปหรือ PDF ผังองค์กรคู่แข่ง → Gemini Vision ดึงทุก node (ชื่อ/ตำแหน่ง/หัวหน้า) พร้อม retry → match กับ candidate ในระบบอัตโนมัติ | `api/ai/parse-org-image`, `org-chart-v2` |
| CSV bulk import | นำเข้า candidate/experience จำนวนมาก + import log | `candidates/import`, `actions/csv-actions.ts` |
| Duplicate detection | normalize ชื่อ/อีเมล/LinkedIn ก่อนสร้าง candidate | `actions/candidate-check.ts`, `lib/candidate-utils.ts` |

> ⚠️ หมายเหตุสำหรับ deck: `n8n-resume-processor.json` ใน repo เป็นโครง workflow (มี node "Mock Parser") — parser จริงทำงานบน n8n server ไม่ได้อยู่ใน repo ถ้าจะอ้างตัวเลขความแม่นยำของ resume parsing ควรเช็คกับทีมก่อน

### Pillar 2 — AI Search (Hybrid: Structured SQL + Vector/RAG + LLM)
**Funnel 3 ชั้น ที่คุม cost โดยให้ LLM แพงๆ อ่านแค่ top 20**

```
User พิมพ์ภาษาธรรมชาติ ("หา GM โรงแรม 5 ดาวในไทย เคยอยู่ Marriott")
   ↓ Stage 1 — Filter/SQL Retrieval   → pool 200–1,000 คน (ms)
   ↓ Stage 2 — Vector Ranking          → Top 20 (embed JD ด้วย Vertex, similarity ใน pgvector)
   ↓ Stage 3 — AI Assessment           → คะแนน 4 มิติ + เหตุผล + สรุปเทียบกันทั้งกลุ่ม
```

- **NL → Filter**: Claude Haiku 4.5 แปลง query เป็น filter JSON + "suggestions" (chip แนะนำให้ขยายเงื่อนไข) — ผู้ใช้ปรับเองต่อได้ ไม่ต้อง prompt ซ้ำ (`actions/ai-search-demo.ts`)
- **Filter 11+ แกน** + cascading (exclude-self pattern ผ่าน RPC): Position keyword/level, Industry group/industry, Region/Country (work country แยกจาก "Based in"), Hotel chain / sub-brand / star rating, Current-job-only, Job function, Company
- **Chat-first search (V3) — ใช้งานจริงแล้ว** ทั้งหน้า AI Search และหน้า JR Manage ใช้ทั้ง brainstorm กับ AI และทำ AI Assessment: Agent Manager + sub-agent (SQL specialist ผ่าน MCP, web search, vector rank, batch categorize) ตอบในแชท หรือกด "Apply to filters" ส่งเงื่อนไขเข้า filter panel (`ai-search-v3`, `api/ai-search-chat`)
- **Assistant (streaming tool-use)**: `/assistant` ใช้ AI SDK + tool `searchCandidates`/`setFilters`/`getAnalytics` ตอบเป็นภาษาเดียวกับผู้ใช้ (ไทย/อังกฤษ)
- **Search suggestion** ด้วย trigram index (autocomplete ชื่อบริษัท/ตำแหน่งเร็ว)
- ผลลัพธ์ Stage 1 เก็บเป็น session (`v2_search_results`) → ต่อ Stage 2/3 ได้โดยไม่ต้อง query ใหม่

### Pillar 3 — AI Candidate Assessment & Ranking
- **คะแนนรวม 100 = Experience 25 + Leadership 25 + Market 25 + Skills 25** พร้อม strengths / gaps / trade-off รายคน และ summary (highlights, Top 5, final recommendation) (`actions/ai-ranking.ts`, `docs/stage2_3_ranking_system.md`)
- Pipeline บน n8n: Workflow A (รับคิว) → B (ประเมินรายคน) → C (สรุป & จัดอันดับ) เชื่อมกันด้วย webhook chaining + schedule สำรองกัน job ค้าง
- **Progressive UI**: poll ทุก 3–4 วินาที เห็นผลทีละคนระหว่างที่ AI ทำงาน มี score bar สีตามเกณฑ์, rank badge, category tab, job history
- ใช้ได้ 2 โหมด: ภายใน JR ("AI Suggestion" tab) และจากหน้า Search โดยตรง (`jr_id` nullable)
- Design decision: ตัด Stage "pass/fail screening" ออก เพราะ Stage 1 filter แม่นพอ → ลด cost และ latency

### Pillar 4 — Data Infrastructure (ฐานที่ทำให้ AI แม่น)
นี่คือ moat จริง: AI search จะดีได้เพราะข้อมูลถูก standardize ก่อน

| Layer | ทำอะไร |
|---|---|
| **Company master + variation** | resolve ชื่อบริษัทดิบหลายแบบ → `company_id` เดียว, ดึง industry/group/rating/logo จากจุดศูนย์กลาง (`company_master`, `company_variation`) |
| **Hotel chain system** | 92 parent chains / 399 sub-brands + star rating, map 1,282 companies, มี admin UI ทำ mapping ต่อ (`HotelChainMappingTab`) — ตัดสินใจไม่ใช้ fuzzy match โดยเจตนา เพื่อไม่ให้ rating ผิด (Holiday Inn 4★ ≠ Holiday Inn Express 3★) |
| **Controlled vocab** | `position_keyword_vocab` (rule-based mapped 88.8% ของ ~37.6k experiences), industry/group vocab, country→region |
| **Location trust model** | แยก work country (มี `note` บอกแหล่งที่มา) กับ current residence; HQ-guessed country ถูก treat as NULL ใน filter แต่ไม่ลบข้อมูล; parse country จาก full_address กู้ 3,030 rows (coverage ~97%) |
| **Postgres RPC layer** | `search_candidate_ids`, `get_cascading_options`, `get_search_summary`, `get_company_chain_info`, population/analytics RPCs — logic ค้นหาอยู่ใน DB เดียว ใช้ซ้ำทุกหน้า |
| **Audit trail** | `status_log` ทุกการเปลี่ยนสถานะ, `jr_candidate_logs`, activity log, chat history ต่อ JR |
| **Data quality tooling** | หน้า Data Aging report, `fill_position_keywords`, company industry classification ด้วย AI (n8n batch prompts), age recalculation, usage report |
| **Dual-DB** | Supabase A (ธุรกรรม) + B (vector ranking) ผ่าน n8n |

ตัวเลขข้อมูล: ~8,900 candidate profiles, ~48,500 experience rows, ~18,000 companies, ~925 GM hotel list สำหรับ audit

### Pillar 5 — Pipeline / Workflow Automation
- **Job Requisition (JR) lifecycle**: สร้าง JR → Add candidates (bulk หรือ by-filter) → Pool Candidate → Longlist / Top Profile → Interview → Offer → Placement / Resignation; Kanban board, copy JR, JR notes, head-recruit notes
- **Validation อัตโนมัติ**: blacklist block, duplicate-in-JR skip, status ถูก derive จาก `status_log`
- **Stage Aging + Pending Tasks**: บอกว่า candidate ค้างใน stage ไหนนานเกินไป, stage owner role, JR maintenance board — ระบบ "ไล่งาน" ให้แทนคน
- **Dashboard**: KPI, Search & Placement funnel, Recruiter performance, population/gender/market breakdown
- **Placement & Resignation tracking**, Employment record (เงินเดือนที่เคยจ่ายจริง)
- **Notifications** (NotificationCenter) + n8n job queue/monitor (`/admin/n8n`)
- **Pre-screen log + Interview feedback** เก็บ rating, feedback, ไฟล์แนบ

### Pillar 6 — Document Preparation & Ready-for-Human-Review ⭐ (จุดขายสำคัญ)
ระบบเตรียมเอกสาร "พร้อมส่ง" ให้ ทำให้คนเหลือแค่ตรวจแล้วเซ็น/ส่ง

| Output | สร้างโดยอัตโนมัติจาก | ไฟล์ |
|---|---|---|
| **Short Profile deck (PPTX)** | Top Profile ของ JR → สไลด์ละ 6 คน พร้อมรูป, ประวัติงาน (compact), การศึกษา, ranking | `actions/export-jr-report.ts` (pptxgenjs + sharp) |
| **Longlist deck** | candidate roster ทั้ง JR 15 คน/หน้า | เดียวกัน |
| **AI Assessment report (PPTX)** | ผล Stage 3: คะแนน, strengths/gaps, market breakdown ของ pool | `actions/export-pptx.ts` |
| **JD → PDF** | JD ที่ paste จาก Word/Outlook → PDF ภาษาไทย/สัญลักษณ์ถูกต้อง (Noto Sans) เก็บใน storage | `lib/jd-pdf.ts` |
| **Org Chart → PPTX** | Overview / Team details / Short profile / CSV export | `lib/org-chart-pptx/*` |
| **One-click email** | แนบ PPTX ส่งผ่าน Gmail API ถึงลูกค้า/ผู้ร่วมงาน | `actions/share-report.ts` |
| **Placement report export** | | `actions/export-placement-report.ts` |
| **Salary Benchmark** | ต่อ JR: cohort จาก DB ของเราเอง (ระบุชัดว่า internal data) เทียบ budget + เงินเดือนที่เคยจ่ายจริง | `SalaryBenchmarkTab.tsx` |
| **Compensation summary** | salary/bonus/allowance/provident fund/insurance ต่อ candidate | `compensation-*.tsx` |
| **JR AI chat** | chat ผูกกับ JR (n8n + memory ต่อ JR) ถามตอบเรื่อง candidates ใน JR นั้น | `actions/jr-ai-chat.ts` |

**Human-in-the-loop design**: AI เสนอ → คนเห็นเหตุผล (strengths/gaps/trade-off) + แก้ filter/criteria ได้ → export/ส่ง; ทุกการเปลี่ยนสถานะมี audit log

### Pillar 7 — Org Chart Intelligence (differentiator)
- สร้าง/โคลน/แก้ org chart ของบริษัท (d3-org-chart), อัปโหลดรูป → AI แปลงเป็นโครง, ผูก node กับ candidate ในระบบ, ตรวจ ex-Central/CG group (`cg-company-match`), alert เมื่อข้อมูลเก่า
- ใช้ทำ **talent mapping** ของคู่แข่ง: ใครอยู่ตำแหน่งไหน ใครเป็นหัวหน้า → ส่งออกเป็น PPTX ได้

### Pillar 8 — Platform / Security / Ops
Supabase Auth + RLS + role/permission (unauthorized page), user profiles, prompt/model/key config ใน DB (เปลี่ยน prompt ไม่ต้อง deploy), usage report, theme/dark mode, migrations versioned

---

## 4. จุดขาย (Selling Points) ที่เสนอให้ใช้ใน Deck

1. **"AI ทำ 80%, คน review 20%"** — เอกสาร → candidate profile → shortlist → ranking → deck ส่งลูกค้า ครบ loop ในระบบเดียว
2. **Cost-controlled AI (Funnel)** — SQL → Vector → LLM top-20 เท่านั้น ไม่เผา token กับทุกคน; ใช้โมเดลเล็กถูกกับงานง่าย (Haiku/Flash) โมเดลใหญ่เฉพาะสรุปจัดอันดับ
3. **Data moat** — standardize บริษัท/ตำแหน่ง/chain/rating/country ก่อน AI ทำให้ผลค้นหาแม่น และ transparent เรื่องความน่าเชื่อถือของข้อมูล (location source, rating ที่ขาด)
4. **Explainable ranking** — คะแนน 4 มิติ + strengths/gaps/trade-off ไม่ใช่กล่องดำ
5. **Human-in-the-loop โดยดีไซน์** — AI เสนอ filter เป็น chip ให้คนปรับ, audit log ทุก status, validation (blacklist/duplicate)
6. **Model-agnostic, orchestration แยก** — Claude + Gemini + Vertex embeddings สลับได้ผ่าน config/n8n, long-running job ไม่ block UI
7. **Vertical depth** — hotel chain/sub-brand/star rating, GM-level talent mapping, org chart intelligence — ยากที่ ATS ทั่วไปจะลอกได้
8. **Progressive UX** — เห็นผลทีละคน, auto-suggest, chat + filter ทำงานร่วมกัน
9. **Reusable pattern** — pipeline "ingest → standardize → retrieve → LLM assess → generate deliverable → human review" ใช้ซ้ำกับงานอื่นได้ (ข้อ 9)

---

## 5. สิ่งที่ควรพูดตรงๆ (กัน over-claim)

> แก้ไข: เดิมเอกสารนี้ระบุว่า AI Search V3 "ยังพัฒนา" ซึ่งผิด (อ้างจาก docs เก่า) เจ้าของระบบยืนยันว่า V3 ใช้งานจริงแล้ว ส่วน docs/ai-search-v3-plan.md ยังไม่ได้อัปเดตตามสถานะปัจจุบัน

- Stage 2 แบบ pass/fail screening ถูกตัดออกโดย decision (ไม่ใช่ขาด)
- Salary Benchmark ใช้ข้อมูลภายใน ไม่ใช่ market survey ภายนอก
- Hotel chain mapping ยังไม่ครบ (1,282 mapped; ที่เหลือมี admin UI รองรับ)
- Resume parser จริงอยู่ฝั่ง n8n ต้องยืนยันตัวเลข accuracy ก่อนใส่ใน deck
- ยังไม่มี automated test suite ใน repo (ตรวจจาก `package.json` มีแค่ lint)

---

## 6. Tech Stack

Next.js 15 / React 19 / TypeScript / Tailwind + Radix UI · Supabase (Postgres, Auth, Storage, RLS, RPC, pg_trgm) · n8n (self-host บน Hostinger) · Anthropic SDK (Haiku 4.5, Sonnet) · Google Gemini + Vertex embeddings · Vercel AI SDK (streaming tool-use) · pptxgenjs, pdfkit, sharp, jszip · googleapis (Gmail) · d3-org-chart

---

## 7. Key Routes (สำหรับ screenshot ใน deck)

`/` Overview · `/dashboard` · `/pending-tasks` · `/candidates` · `/candidates/pre-screen` · `/requisitions` + `/requisitions/manage` (AI Suggestion, Salary Benchmark, Stage Aging) · `/ai-search-demo` · `/ai-search-v3` · `/assistant` · `/org-chart-v2` · `/placement` · `/reports/aging` · `/reports/usage` · `/admin/companies` · `/admin/n8n` · `/settings`

---

## 8. Slide Outline ที่แนะนำ (12–14 สไลด์)

1. Title + one-liner
2. ปัญหาของ recruiter วันนี้ (งานซ้ำ, ข้อมูลสกปรก, AI แพง)
3. Solution: "AI ทำให้ คนแค่ review" — flow diagram End-to-End
4. Architecture overview (diagram ข้อ 2)
5. Document parsing (resume / paste / org chart image / CSV)
6. Data infrastructure & standardization (moat) + ตัวเลข
7. AI Search funnel 3 stages (SQL → Vector → LLM) + cost control
8. Filter + NL + Chat (screenshot `/ai-search-demo`, `/ai-search-v3`)
9. AI Assessment: 4-dimension score, explainable (screenshot Stage3 panel)
10. Pipeline: JR lifecycle, Kanban, Stage aging, Pending tasks, Dashboard
11. Document prep: auto-generated PPTX/PDF + email (before/after: ใช้เวลากี่ชม. → กี่นาที *ต้องวัดเพิ่ม*)
12. Org Chart intelligence
13. Human-in-the-loop & governance (audit log, validation, RLS)
14. Reuse for other projects + next steps (ข้อ 9)

---

## 9. นำไปเสนอโปรเจคอื่นได้อย่างไร (Reusable Building Blocks)

| Block | ใช้ซ้ำกับ |
|---|---|
| Document ingestion → structured JSON (config-driven prompt) | งาน back-office ที่รับเอกสารเยอะ: HR onboarding, invoice/contract intake, KYC |
| Entity resolution (master + variation) + controlled vocab | CRM/Vendor master, Product catalog cleaning |
| NL → filter JSON + cascading filter RPC | Internal data portal, BI self-service |
| SQL → Vector → LLM funnel พร้อม progressive UI | Knowledge search, Case/Ticket triage, Sourcing/Procurement |
| n8n async job + polling + chaining + fallback schedule | Long-running AI workflow ใดก็ได้ |
| Explainable multi-dimension scoring | Vendor evaluation, Lead scoring, Application review |
| Auto-generated PPTX/PDF + email | Client reporting, Proposal automation |
| Org chart from image + talent mapping | Competitive intelligence, Account mapping ใน sales |

---

*อ้างอิงเอกสารเชิงลึกใน repo:* `docs/ATS_AI_Agents_Summary.md`, `docs/ai-search-v3-plan.md`, `docs/stage2_3_ranking_system.md`, `docs/hotel_chain_system.md`, `docs/country_location_system.md`, `docs/company_id_system.md`, `docs/jr_salary_benchmark_and_stage_aging.md`, `docs/compensation_benefits_fields.md`
