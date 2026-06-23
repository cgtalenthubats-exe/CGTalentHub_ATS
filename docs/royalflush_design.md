# Royal Flush ATS — Project Overview, Design & CGTalentHub Reuse Guide

> **HANDOFF DOC (ฉบับละเอียด)** — เอกสารนี้สรุปทุกอย่างของโปรเจค **Royal Flush** + ลงลึกว่าเอาอะไรจาก CGTalentHub มาใช้ได้บ้างถึงระดับไฟล์/ฟังก์ชัน
> เป้าหมาย: ยกไปทำต่อใน repo `cgtalenthubats-exe/RoyalFlush_ATS` บน VS Code ได้ทันที โดยไม่ต้องย้อนดู PDF หรือบทสนทนาเดิม
> repo `RoyalFlush_ATS` แตกมาจาก CGTalentHub → โค้ดทั้งหมดในเอกสารนี้มีอยู่ในมือแล้ว แค่ปรับ/ลบ

---

## สารบัญ
1. ภาพรวมโปรเจค (โปรเจคนี้คืออะไร)
2. Scope (จาก requirement PDF)
3. หน้าหลัก 4 หน้า (จาก mockup)
4. Design Decisions (ตกลงแล้ว)
5. **Reuse Map — เอาอะไรจาก CGTalentHub มาใช้ (ละเอียด)**
6. **Per-Page Build Guide — แต่ละหน้าใช้ไฟล์ไหน แก้ตรงไหน**
7. **Infrastructure ที่ reuse ได้เลย (clients, ui, utils)**
8. **สิ่งที่ต้องลบทิ้งจาก CGTalentHub**
9. Database Schema (finalized SQL)
10. Data Input Process
11. Dummy Data Spec
12. Supabase MCP Setup (Claude Desktop / VS Code)
13. Environment Variables
14. Build Order (ลำดับงาน)

---

## 1. ภาพรวมโปรเจค

**Royal Flush Project 1.0** = Integrated People / Compensation / Performance platform สำหรับ **พนักงานภายในระดับสูงของ Central Group (CG)**

| | CGTalentHub ATS | Royal Flush ATS |
|---|---|---|
| Entity หลัก | Candidate (ผู้สมัครภายนอก) | **Employee (พนักงานภายใน CG)** |
| จุดเน้น | Recruitment / ATS pipeline | **Compensation + Performance + Org** |
| Scope | ใหญ่ (search, JR, AI pipeline) | **เล็กกว่ามาก** (3–4 หน้า) |
| Comp model | Thai (฿, gross_salary_b_mth, bonus_mth) | **European (€, STI/LTI)** |

**Stack เดียวกัน:** Next.js 15 (App Router) + Supabase + Anthropic Claude + Vercel
**Supabase:** project **แยกต่างหาก คนละ org** กับ CGTalentHub (เหตุผล: HR sensitive data, access control แยก, กัน human error)

---

## 2. Scope (จาก requirement PDF)

### อยู่ใน 1.0 (✓)
- ✓ Employee Personal Data
- ✓ Compensation (ระดับ company, รวม bonus)
- ✓ Org structure — **By Banner** + **By Function**

### ยังไม่ทำ (❑ future)
- ❑ HR Cycle · ❑ Business Performance · ❑ Succession Plan

### ข้อกำหนดเฉพาะ (กระทบ schema/feature)
- Compensation ระดับ company รวม **bonus amounts**
- Employee status: **Active / Resigned**
- แสดง **Years in Position** + **Years of Service**
- Org อย่างน้อยถึงระดับ **line manager**
- **Performance Grade** + historical 5 ปี
- **Profile Comparison:** filter เทียบ comp อย่างเดียว → **bar chart สูง→ต่ำ (ไม่รวม benefits)** · **export raw data** tabular · ดู **comp history** (salary adjustment 3 ปี)
- **Employment History** = เฉพาะภายใน CG; external ไปอยู่ใต้ section **"Background"**
- Compliance: **GDPR / PDPA** + Access Governance

---

## 3. หน้าหลัก 4 หน้า (จาก mockup)

### 3.1 Employee Profile
- **Hero:** photo, name, position title, banner (company), country
- **5 stat cards:** Total Compensation (€) · Years of Service · Current Performance (FY ล่าสุด) · Team Size (direct reports) · Readiness/Potential
- **Personal & Employment:** DoB, Hire Date, Years of Service, Current Job Effective Date, Education, Previous Work Experience, Certification/License
- **Compensation & Benefits:** Compensation, Base/Salary, STI Target, LTI Target, STI Max, LTI Max, Other Bonus, Allowances (company_car, mobility, home_office, private_medical, family_cover), Last 3Y/5Y Historical Adjustment
- **Performance Grade — Last 5 Years:** FY2021–25, grade (A/A-/B+/B) + label (Excellent/Very Good/Good)
- **Org Chart Snapshot:** line manager → employee → direct reports (banner dimension)
- **Key Insights:** Top Performer / Leadership Potential / Talent Status — **AI generate (ปุ่ม) หรือ user กรอกเอง** + "View Full Talent Profile"

### 3.2 Employee Comparison
- เลือก employees สูงสุด ~5 คน
- **Summary badges:** Highest Total Comp · Highest Tenure · Newest to Role · Largest Team
- **ตารางเทียบ item-by-item:** Personal & Employment / Compensation & Benefits / Performance 5 ปี / Org Snapshot ต่อคน
- **filter compensation-only → bar chart** สูง→ต่ำ (ไม่รวม benefits)
- **Export Comparison** → HTML/CSS standalone (เอาไป present ได้เลย)

### 3.3 Global Organization Structure — By Banner
- KPI: Total Countries, Total Employees, Regional Offices, HQ Location
- Global Presence map · Branch Summary table (Country/City/Employees/Country Head/Main Functions) · Org tree group ตาม banner/ประเทศ · Key Insights

### 3.4 Function Structure — By Function
- KPI: Countries, Function Employees, Managers, Global Function Head
- Org tree ตาม function ข้ามประเทศ (Global HR Director → Regional HR Lead → country HR managers) · Key Insights

---

## 4. Design Decisions (ตกลงแล้ว — อย่าเปลี่ยนโดยไม่ถาม)

| # | เรื่อง | ตัดสินใจ |
|---|---|---|
| D1 | Compensation model | **European STI/LTI (€)** + `currency` field (default EUR) — ไม่ใช่ Thai ฿ |
| D2 | Org structure | **2 มิติแยก parent** ผ่าน `org_edges` (`dimension` = banner/function); By Function = subset; เทียบ Banner-vs-Banner / Function-vs-Function ได้ |
| D3 | Banner | = 1 company / branch |
| D4 | Function | = แผนก (HR, Finance…) |
| D5 | ข้อมูลชุดแรก | **Dummy data ก่อน** (~5 คน + managers + หลายประเทศ) |
| D6 | Export Comparison | **HTML/CSS standalone** (หรือ PDF) ใช้ `html-to-image` + `jspdf` ที่มีใน deps |

---

## 5. Reuse Map — เอาอะไรจาก CGTalentHub มาใช้ (ละเอียด)

> สัญลักษณ์: 🟢 ใช้เกือบทั้งดุ้น · 🟡 ใช้เป็น pattern/อ้างอิงแล้วปรับเยอะ · 🔵 infra ใช้ได้เลย

### 5.1 หน้า Profile
| ไฟล์ CGTalentHub | บทบาท | reuse action |
|---|---|---|
| `src/app/candidates/[id]/page.tsx` | layout profile: hero + sidebar cards + comp grid + experience timeline + sections | 🟡 copy เป็นโครง `src/app/employees/[id]/page.tsx` แล้วแทน field candidate → employee, comp Thai → STI/LTI, เพิ่ม Performance 5 ปี + Org Snapshot + Key Insights |
| `src/components/candidate-edit-form.tsx` | ฟอร์มแก้ไข (มี section Salary/Bonus/Benefits อยู่แล้ว — บรรทัด ~665+) | 🟡 ต้นแบบ employee edit form |

### 5.2 หน้า Comparison
| ไฟล์ CGTalentHub | บทบาท | reuse action |
|---|---|---|
| `src/app/dashboard/PackageInfoTab.tsx` | **คือ benchmark/comparison ตัวจริง** — มี cascading multi-filter + `SalaryDotChart` + fetch-all-then-client-filter | 🟢 pattern ตรงเป๊ะกับ Employee Comparison — copy แล้วเปลี่ยน dataset เป็น employees, dot chart → bar chart สูง→ต่ำ |
| `src/app/actions/benchmark-actions.ts` | `getRawBenchmarkData()` — ดึง comp ทั้งหมด + merge experience ล่าสุด | 🟡 ต้นแบบ `getEmployeeComparisonData()` |
| `src/lib/benchmark-utils.ts` | `parseSalary()`, `hasBenefit()` | 🟢 helper ใช้ได้เลย |
| `src/components/ui/filter-multi-select.tsx` | multi-select filter chip | 🟢 ใช้เลย |

### 5.3 Org Chart (Snapshot + By Banner + By Function)
| ไฟล์ CGTalentHub | บทบาท | reuse action |
|---|---|---|
| `src/components/org-chart/org-chart-viewer.tsx` | viewer หลัก ใช้ `react-d3-tree` + zoom/pan/focus | 🟢 reuse engine — feed tree จาก `org_edges` แทน `all_org_nodes` |
| `src/components/org-chart/org-chart-viewer-v2.tsx` | viewer v2 (d3-org-chart) | 🟡 ทางเลือก |
| `src/app/actions/org-chart-actions.ts` | สร้าง/อ่าน tree, match candidate | 🟡 ต้นแบบ — เขียน `getOrgTree(dimension, root)` ใหม่ให้อ่าน `org_edges` |
| `src/lib/org-chart-pptx/*` | **export org chart เป็น PPTX อยู่แล้ว** (`exportOrgChartPptx`) | 🟡 มี export infra อยู่ — แต่ requirement อยากได้ HTML/CSS ดูข้อ D6 |
| `src/app/org-chart/page.tsx`, `org-chart-v2/` | หน้า org chart | 🟡 ต้นแบบหน้า By Banner / By Function |

### 5.4 Data Import
| ไฟล์ CGTalentHub | บทบาท | reuse action |
|---|---|---|
| `src/app/candidates/import/page.tsx` | UI bulk import: Papa parse + preview table + commit | 🟡 ต้นแบบหน้า import employee |
| `src/app/actions/csv-actions.ts` | `processCsvUpload()` — server action import | 🟡 ปรับ mapping → employees/comp/perf |
| `src/components/import/LogTableRow.tsx` | แถว log การ import | 🟢 |

### 5.5 AI (Key Insights)
| asset | บทบาท | reuse action |
|---|---|---|
| `@anthropic-ai/sdk` (deps) + pattern เรียก Claude ใน `src/app/api/ai/*` | เรียก Claude | 🟢 ใช้ pattern เดิม → prompt generate Key Insights จาก comp+perf+tenure |

### 5.6 Export (Comparison → present)
| asset | บทบาท | reuse action |
|---|---|---|
| `html-to-image`, `jspdf` (deps) | snapshot DOM → PNG/PDF | 🟢 ใช้ทำ Export Comparison |
| `jszip` (deps) | zip หลายไฟล์ | 🟢 เผื่อ export หลายคน |

---

## 6. Per-Page Build Guide — แต่ละหน้าใช้ไฟล์ไหน แก้ตรงไหน

### หน้า Employee Profile → `src/app/employees/[id]/page.tsx`
1. copy โครงจาก `candidates/[id]/page.tsx`
2. แทน data source: `fetch('/api/candidates/[id]')` → query `employees` + joins (`employee_compensation`, `performance_grades`, `org_edges`, `employee_insights`, `employment_history`, `employee_background`)
3. Hero: candidate fields → employee (name, photo, position_title, banner.name, country)
4. แทน stat cards (5 ใบ) — คำนวณ Years of Service/Position จาก date, Team Size จาก count org_edges, Current Performance จาก latest grade
5. Comp grid: เปลี่ยน Thai fields → STI/LTI/allowances (€)
6. เพิ่มใหม่: Performance timeline (5 ปี), Org Snapshot (embed org-chart-viewer แบบ mini), Key Insights card + ปุ่ม "Generate with AI"

### หน้า Employee Comparison → `src/app/comparison/page.tsx`
1. copy โครงจาก `dashboard/PackageInfoTab.tsx` (มี cascading filter + chart + client-filter ครบ)
2. dataset: `getRawBenchmarkData()` → `getEmployeeComparisonData()` (ดึง employees + comp + perf + team size)
3. เพิ่ม "เลือกพนักงาน" (สูงสุด 5) ด้านบน
4. `SalaryDotChart` → bar chart total_compensation สูง→ต่ำ (toggle "compensation only")
5. ตารางเทียบ item-by-item (4 section)
6. ปุ่ม Export → html-to-image/jspdf (D6)

### หน้า Org By Banner → `src/app/org/banner/page.tsx`
1. KPI cards + map + Branch Summary table (จาก `banners` + count employees)
2. tree: `getOrgTree('banner', root)` → feed `org-chart-viewer`

### หน้า Org By Function → `src/app/org/function/page.tsx`
1. เหมือน By Banner แต่ `getOrgTree('function', root)`

---

## 7. Infrastructure ที่ reuse ได้เลย (🔵 ก็อปได้ทันที)

### Supabase clients (`src/lib/supabase/`)
- `admin.ts` — service role client (bypass RLS, ใช้ใน server actions) — **ใช้ได้เลย** แค่เปลี่ยน env
- `client.ts` — browser client (`@supabase/ssr`)
- `server.ts` — server client
- `src/utils/supabase/client.ts` — อีก client pattern
- pattern: server action `"use server"` + `import { adminAuthClient } from "@/lib/supabase/admin"` → query ตรง

### Utils
- `src/lib/utils.ts` — `cn()`, `formatNumberWithCommas()`, `parseNumberFromCommas()` 🟢
- `src/lib/date-utils.ts` — `formatMonthYear`, `parseAnyDate`, `formatDateForDisplay` 🟢 (ใช้คำนวณ tenure/format ได้)
- `src/lib/benchmark-utils.ts` — `parseSalary`, `hasBenefit` 🟢

### UI Component Library (`src/components/ui/`) — 🟢 ยกมาทั้งชุด (shadcn/radix)
```
accordion, alert, alert-dialog, async-filter-multi-select, avatar, badge,
button, card, checkbox, command, dialog, dropdown-menu, filter-multi-select,
input, label, popover, radio-group, scroll-area, select, separator, sheet,
slider, status-select, table, tabs, textarea, tooltip
```
ครบสำหรับทุกหน้า Royal Flush ไม่ต้องสร้าง component พื้นฐานใหม่

### Deps ที่มีพร้อม (package.json) — ไม่ต้องลงเพิ่ม
`@anthropic-ai/sdk`, `@supabase/ssr`, `@supabase/supabase-js`, `react-d3-tree`, `d3-org-chart`, `framer-motion`, `html-to-image`, `jspdf`, `jszip`, `papaparse`, `csv-parse`, `date-fns`, `lucide-react`, `@tanstack/react-virtual`, `recharts`/`d3-scale`

---

## 8. สิ่งที่ต้องลบทิ้งจาก CGTalentHub (cleanup ใน repo ใหม่)

ลบเพื่อลดความรก (ไม่เกี่ยวกับ Royal Flush):
- `src/app/ai-search/`, `ai-search-v2/`, `ai-search-v3/`, `ai-search-demo/` — AI search ทั้งหมด
- `src/app/assistant/` — chat pipeline
- `src/app/requisitions/`, `src/app/actions/jr-candidates.ts`, `jr-*` components — JR system
- `src/app/pending-tasks/`, `src/app/placement/` — recruiter workflow
- `src/app/admin/n8n/`, `src/app/api/n8n/` — n8n integration
- `docs/hotel_chain_system.md`, `docs/country_location_system.md` — hospitality-specific
- table/RPC ฝั่ง Supabase ที่เกี่ยวกับ candidate/JR/hotel chain (project ใหม่เริ่ม schema สะอาดอยู่แล้ว)

**เก็บไว้:** `components/ui/*`, `lib/supabase/*`, `lib/utils.ts`, `lib/date-utils.ts`, org-chart engine, import flow, benchmark pattern, `lib/org-chart-pptx/*`

---

## 9. Database Schema (finalized SQL — พร้อม apply)

```sql
-- ===== Master =====
CREATE TABLE banners (              -- = 1 company / branch
  banner_id          bigserial PRIMARY KEY,
  name               text NOT NULL,
  country            text,
  city               text,
  is_hq              boolean DEFAULT false,
  is_regional_office boolean DEFAULT false,
  country_head_id    bigint,        -- FK employees (set ภายหลัง)
  main_functions     text[]
);

CREATE TABLE functions (
  function_id      bigserial PRIMARY KEY,
  name             text NOT NULL,   -- HR, Finance, Marketing…
  global_head_id   bigint           -- FK employees
);

-- ===== Core =====
CREATE TABLE employees (
  employee_id             bigserial PRIMARY KEY,
  name                    text NOT NULL,
  photo                   text,
  date_of_birth           date,
  nationality             text,
  country                 text,
  city                    text,
  status                  text DEFAULT 'Active',     -- Active | Resigned
  banner_id               bigint REFERENCES banners(banner_id),
  function_id             bigint REFERENCES functions(function_id),
  position_title          text,
  job_grade               text,
  hire_date               date,
  position_effective_date date,                       -- → Years in Position
  readiness_potential     text,                       -- High | Medium | Low
  resign_date             date,
  resignation_reason      text,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

-- ===== Org (2 มิติ, parent แยกกัน) — Decision D2 =====
CREATE TABLE org_edges (
  id                 bigserial PRIMARY KEY,
  employee_id        bigint NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
  parent_employee_id bigint REFERENCES employees(employee_id),   -- NULL = top of tree
  dimension          text NOT NULL CHECK (dimension IN ('banner','function')),
  UNIQUE(employee_id, dimension)
);
-- By Banner tree   : where dimension='banner'
-- By Function tree : where dimension='function' (subset)
-- Org Snapshot     : banner-line manager + direct reports
-- Team Size        : count where parent_employee_id = X and dimension='banner'

-- ===== Compensation (European STI/LTI) — Decision D1 =====
CREATE TABLE employee_compensation (
  employee_id               bigint PRIMARY KEY REFERENCES employees(employee_id) ON DELETE CASCADE,
  currency                  text DEFAULT 'EUR',
  base_salary               numeric,
  sti_target                numeric,
  sti_max                   numeric,
  lti_target                numeric,
  lti_max                   numeric,
  other_bonus               numeric,
  allowance_company_car     numeric,
  allowance_mobility        numeric,
  allowance_home_office     numeric,
  allowance_private_medical numeric,
  allowance_family_cover    numeric,
  total_compensation        numeric,    -- derived: base + sti_target + lti_target + other_bonus + allowances
  updated_at                timestamptz DEFAULT now()
);

CREATE TABLE compensation_history (   -- salary adjustment ย้อนหลัง 3–5 ปี
  id                bigserial PRIMARY KEY,
  employee_id       bigint REFERENCES employees(employee_id) ON DELETE CASCADE,
  fiscal_year       int,
  effective_date    date,
  base_salary       numeric,
  total_comp        numeric,
  adjustment_amount numeric,
  note              text
);

-- ===== Performance (5 ปี) =====
CREATE TABLE performance_grades (
  id           bigserial PRIMARY KEY,
  employee_id  bigint REFERENCES employees(employee_id) ON DELETE CASCADE,
  fiscal_year  int NOT NULL,         -- 2021..2025
  grade        text,                 -- A, A-, B+, B…
  label        text,                 -- Excellent, Very Good, Good
  UNIQUE(employee_id, fiscal_year)
);

-- ===== History / Background =====
CREATE TABLE employment_history (     -- เฉพาะภายใน Central Group
  id           bigserial PRIMARY KEY,
  employee_id  bigint REFERENCES employees(employee_id) ON DELETE CASCADE,
  banner       text,
  position     text,
  start_date   date,
  end_date     date,
  is_current   boolean DEFAULT false
);

CREATE TABLE employee_background (    -- external (นอก CG) + education + cert
  id           bigserial PRIMARY KEY,
  employee_id  bigint REFERENCES employees(employee_id) ON DELETE CASCADE,
  type         text,                 -- experience | education | certification
  title        text,
  organization text,
  detail       text,
  sort_order   int DEFAULT 0
);

-- ===== Key Insights (AI หรือ manual) =====
CREATE TABLE employee_insights (
  id           bigserial PRIMARY KEY,
  employee_id  bigint REFERENCES employees(employee_id) ON DELETE CASCADE,
  category     text,                 -- Top Performer | Leadership Potential | Talent Status
  content      text,
  source       text DEFAULT 'manual',-- ai | manual
  generated_at timestamptz DEFAULT now()
);
```

**Computed (ไม่เก็บ):** Years of Service ← hire_date · Years in Position ← position_effective_date · Team Size ← count org_edges (banner) · Current Performance ← latest performance_grades

**RPC ที่น่าจะสร้าง:** `get_org_tree(p_dimension, p_root)`, `get_comparison_data(p_employee_ids[])` (หรือทำ client-side แบบ benchmark pattern)

---

## 10. Data Input Process

### A. Bulk Import (หลัก — initial load + dummy)
- Excel/CSV 1 sheet ต่อ entity: employees, compensation, performance, comp_history
- คอลัมน์ `manager_employee_id` → สร้าง `org_edges` (banner) อัตโนมัติ; `function_manager_employee_id` → org_edges (function)
- Reuse `processCsvUpload` + Papa parse + preview
- Validation: manager มีจริง, FY ไม่ซ้ำ, currency valid, ไม่มี cycle

### B. Manual Form (รายคน)
- Reuse `candidate-edit-form` → tab: Personal / Compensation / Performance / Insights

### C. AI Insight (ปุ่มใน Profile)
- ส่ง comp + performance + tenure + org → Claude → Key Insights (3 categories); user override ได้ (`source` flag)

**ลำดับ input:** Banners/Functions → Employees(+manager) → Compensation → Performance/History → Insights

---

## 11. Dummy Data Spec (ชุดแรก — D5)

**Employees (~5–7 คน, อ้างอิง mockup):**
- Alex Morgan — Senior Product Manager, Global Solutions Ltd., Spain, hire 2018, €160k, perf B+, readiness High, team 6
- Sofia Martines (HR Director) · Daniel Lee (Finance Manager) · Emma Rossi (Marketing Lead) · Michael Tan (Operations Manager)
- + line managers (เช่น VP Product เหนือ Alex) · + Global HR Director / Regional HR Leads (test By Function)

**ครอบคลุม:** หลายประเทศ (Spain HQ, France, Germany, Italy, Singapore, Thailand, Australia) · Performance 5 ปี/คน · Comp history 3 ปี/คน · org_edges ทั้ง 2 dimension · อย่างน้อย 1 คน status=Resigned

---

## 12. Supabase MCP Setup (Claude Desktop / VS Code)

> Royal Flush ใช้ Supabase **project แยก คนละ org** → token CGTalentHub เข้าไม่ถึง ต้องตั้ง MCP ใหม่

**Claude Desktop config:**
- Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "supabase-royalflush": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase@latest", "--project-ref=<PROJECT_REF>"],
      "env": { "SUPABASE_ACCESS_TOKEN": "<PERSONAL_ACCESS_TOKEN_ORG_ใหม่>" }
    }
  }
}
```
- `--project-ref` lock ให้แตะแค่ project Royal Flush · token: supabase.com/dashboard/account/tokens (org ใหม่) · ref: Settings → General → Reference ID
- **restart** หลังแก้ · ⚠️ อย่า commit token ลง git
- **VS Code (Claude Code ext):** ใช้ `.mcp.json` ที่ root repo `RoyalFlush_ATS` (scope ตาม folder) — token ผ่าน env var

---

## 13. Environment Variables (.env.local + Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # admin client (lib/supabase/admin.ts)
ANTHROPIC_API_KEY=<key>                        # ใช้ร่วมกับ CGTalentHub ได้
```

---

## 14. Build Order (ลำดับงาน)

| # | งาน | depends |
|---|---|---|
| 1 | ตั้ง Supabase MCP ใหม่ (ข้อ 12) + apply schema (ข้อ 9) | — |
| 2 | Seed dummy data (ข้อ 11) | 1 |
| 3 | ตั้ง env vars + เชื่อม supabase client (ข้อ 7) | 1 |
| 4 | Cleanup ลบ feature CGTalentHub ที่ไม่ใช้ (ข้อ 8) | — |
| 5 | หน้า **Employee Profile** (ข้อ 6) | 2,3 |
| 6 | หน้า **Employee Comparison** + Export HTML | 5 |
| 7 | หน้า **Org By Banner** + **By Function** | 2,3 |
| 8 | ปุ่ม **AI Insight** | 5 |
| 9 | **Data input** — import + manual form (ข้อ 10) | 3 |
| 10 | Rebrand UI "CG Talent Hub" → "Royal Flush" | — |

**เริ่ม #1 → #2 → #5** เห็นผลเร็วสุด (มี profile ข้อมูลจริงให้ดู)

---

*Last updated: 2026-06-23 | Royal Flush ATS Design v2 (detailed) — handoff from CGTalentHub session*
