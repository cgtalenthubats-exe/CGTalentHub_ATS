# Royal Flush ATS — Design & Build Plan

> **HANDOFF DOC** — เอกสารนี้สรุปทุกอย่างที่ตกลงกันไว้สำหรับโปรเจค **Royal Flush** เพื่อยกไปทำต่อใน repo `cgtalenthubats-exe/RoyalFlush_ATS` บน VS Code
> เขียนแบบ self-contained — fresh session อ่านไฟล์เดียวจบ ไม่ต้องย้อนดู PDF หรือบทสนทนาเดิม
> **ที่มา:** แตกจาก codebase CGTalentHub ATS (reuse เยอะ) — ดูหัวข้อ "Reuse Map"

---

## 0. TL;DR — โปรเจคนี้คืออะไร

**Royal Flush Project 1.0** = Integrated People / Compensation / Performance platform สำหรับ **พนักงานภายในระดับสูงของ Central Group (CG)**

ต่างจาก CGTalentHub ตรงที่:
| | CGTalentHub ATS | Royal Flush ATS |
|---|---|---|
| Entity หลัก | Candidate (ผู้สมัครภายนอก) | **Employee (พนักงานภายใน CG)** |
| จุดเน้น | Recruitment / ATS pipeline | **Compensation + Performance + Org** |
| Scope | ใหญ่ (search, JR, pipeline AI) | **เล็กกว่ามาก** (3 หน้าหลัก) |

**Stack เดียวกัน:** Next.js 15 + Supabase + Anthropic Claude + Vercel
**Supabase:** project แยกต่างหาก คนละ org กับ CGTalentHub (ดูหัวข้อ "Supabase MCP Setup")

---

## 1. Scope (จาก requirement PDF — Royal Flush Project 1.0)

### อยู่ใน 1.0 (✓)
- ✓ Employee Personal Data
- ✓ Compensation (รวม bonus, ระดับ company)
- ✓ Org structure — **By Banner** + **By Function**

### ยังไม่ทำ (❑ future versions)
- ❑ HR Cycle
- ❑ Business Performance
- ❑ Succession Plan

### ข้อกำหนดเฉพาะ (สำคัญ — กระทบ schema)
- Compensation ระดับ company รวม **bonus amounts**
- Employee status: **Active / Resigned**
- แสดง **Years in Position** + **Years of Service**
- Org structure อย่างน้อยถึงระดับ **line manager**
- **Performance Grade** + historical performance (5 ปี)
- **Profile Comparison:**
  - filter เทียบ **compensation อย่างเดียว** → bar chart สูง→ต่ำ (ไม่รวม benefits)
  - **export raw data** เป็น tabular
  - ดู **compensation history** (salary adjustment ย้อนหลัง 3 ปี)
- **Employment History** = เฉพาะภายใน Central Group เท่านั้น; ประสบการณ์ภายนอกไปอยู่ใต้ section **"Background"**
- Compliance: **GDPR / PDPA** + Access Governance (เป็น HR sensitive data)

---

## 2. หน้าหลัก 4 หน้า (จาก mockup ใน PDF)

### 2.1 Employee Profile
หน้าโปรไฟล์พนักงานรายคน — layout:
- **Hero header:** photo, name, position title, banner (company), country
- **5 stat cards:** Total Compensation (€), Years of Service, Current Performance (FY ล่าสุด grade), Team Size (direct reports), Readiness/Potential (High/Med/Low)
- **Personal & Employment Information:** Date of Birth, Hire Date, Years of Service, Current Job Effective Date, Education, Previous Work Experience, Certification/License
- **Compensation & Benefits:** Compensation, Base/Salary, STI Target, LTI Target, STI Max, LTI Max, Other Bonus, Allowances (company_car, mobility, home_office, private_medical, family_cover), Last 3Y/5Y Historical Adjustment
- **Performance Grade — Last 5 Years:** FY2021–FY2025 พร้อม grade (A, A-, B+, B) + label (Excellent/Very Good/Good)
- **Org Chart Snapshot:** line manager → employee → direct reports (ใช้ banner dimension)
- **Key Insights:** Top Performer / Leadership Potential / Talent Status — **AI generate ได้ (ปุ่มกด) หรือ user กรอกเอง** + "View Full Talent Profile"

### 2.2 Employee Comparison
เทียบพนักงานหลายคน (สูงสุด ~5 คน) แบบ item-by-item:
- เลือก employees ด้านบน (chip/card ต่อคน)
- **Summary badges:** Highest Total Compensation, Highest Tenure, Newest to Role, Largest Team
- **ตารางเทียบ:** Personal & Employment Information / Compensation & Benefits / Performance Grade 5 ปี / Org Chart Snapshot ต่อคน
- **filter compensation-only → bar chart** สูง→ต่ำ (ไม่รวม benefits)
- **Export Comparison** (ดูหัวข้อ "Export" — ข้อ 3 ของ requirement)

### 2.3 Global Organization Structure — By Banner
- KPI: Total Countries, Total Employees, Regional Offices, HQ Location
- **Global Presence map** (หลายประเทศ)
- **Branch Summary table:** Country | City | Employees | Country Head | Main Functions
- **Org tree** group ตาม banner/ประเทศ
- Key Insights (largest workforce, newest branch ฯลฯ)

### 2.4 Function Structure — By Function
- KPI: Countries, Function Employees, Managers, Global Function Head
- **Org tree ตาม function** ข้ามประเทศ (เช่น Global HR Director → Europe/APAC/Oceania HR Lead → country HR managers)
- Key Insights

---

## 3. Design Decisions (ตกลงแล้ว — อย่าเปลี่ยนโดยไม่ถาม)

| # | เรื่อง | ตัดสินใจ |
|---|---|---|
| D1 | **Compensation model** | **European STI/LTI (€)** ตาม mockup — ไม่ใช่ Thai ฿ แบบ CGTalentHub; มี `currency` field (default `EUR`) รองรับอนาคต |
| D2 | **Org structure** | **2 มิติแยก parent กันชัดเจน** ผ่านตาราง `org_edges` (มี `dimension`): `banner` กับ `function`; By Function = subset ของคนที่อยู่ใน function hierarchy; เทียบ Banner-vs-Banner / Function-vs-Function ได้ |
| D3 | **Banner** | = 1 company / branch (คำที่ลูกค้าใช้) |
| D4 | **Function** | = แผนก (เช่น HR, Finance) |
| D5 | **ข้อมูลชุดแรก** | **Dummy data ก่อน** (ตาม PDF ที่ BU ขอ dummy-data model for testing) — generate ~5 คน + managers + หลายประเทศ เพื่อ test flow ทั้งระบบ |
| D6 | **Export Comparison** | generate เป็น **HTML/CSS standalone** (หรือ PDF) ที่ user เอาไป present ได้เลย — ใช้ `html-to-image` + `jspdf` ที่มีใน deps อยู่แล้ว |

---

## 4. Reuse Map — เอาอะไรจาก CGTalentHub มาใช้

> repo `RoyalFlush_ATS` แตกมาจาก CGTalentHub อยู่แล้ว → โค้ดเหล่านี้มีในมือทันที แค่ปรับ

| CGTalentHub asset | path | ใช้กับ Royal Flush | ระดับ reuse |
|---|---|---|---|
| Candidate detail page (hero + cards + comp grid + timeline) | `src/app/candidates/[id]/page.tsx` | **Employee Profile** layout | 🟢 ~70% |
| Benchmark (fetch-all → client filter → bar chart) | `src/app/actions/benchmark-actions.ts` + `src/app/dashboard/PackageInfoTab.tsx` | **Employee Comparison** | 🟢 pattern ตรงเป๊ะ |
| Org Chart engine (`react-d3-tree` / `d3-org-chart`) | `src/components/org-chart/org-chart-viewer.tsx`, `all_org_nodes`, `org_chart_uploads` | Org Snapshot + By Banner + By Function | 🟢 reuse engine |
| Internal Candidate / `employment_record` (BU, sub_bu, job_grade, hire_date, resign_date, hiring_status) | `src/app/actions/internal-candidates.ts` | = โครง `employees` พอดี (ต้นแบบ) | 🟢 ต้นแบบ schema |
| UI kit (shadcn/radix: card, table, tabs, badge, avatar, dialog…) | `src/components/ui/*` | ทุกหน้า | 🟢 ยกมาทั้งชุด |
| CSV import flow (Papa parse + `processCsvUpload` + preview) | `src/app/candidates/import/page.tsx`, `src/app/actions/csv-actions.ts` | Bulk import พนักงาน | 🟢 ปรับ template |
| Anthropic SDK | `@anthropic-ai/sdk` ใน deps | ปุ่ม **AI Insight** | 🟢 |
| Export libs | `html-to-image`, `jspdf` ใน deps | **Export Comparison** เป็น HTML/PDF | 🟢 |

**สิ่งที่ต้องสร้างใหม่ (gap):**
- Compensation model ใหม่ (STI/LTI, €) — UI grid reuse ได้ แต่ field ใหม่
- `performance_grades` (history 5 ปี) — ใหม่
- `compensation_history` (salary adjustment) — ใหม่
- Readiness/Potential + Key Insights (AI) — ใหม่
- มิติ Banner + Function บน org (`org_edges`) — ใหม่

**Cleanup ที่ควรทำใน repo ใหม่:** ลบหน้า/feature ที่ไม่เกี่ยวกับ Royal Flush ออก (ai-search*, assistant, requisitions, jr-candidates, pending-tasks, hotel chain system ฯลฯ) เพื่อลดความรก — แต่เก็บ `components/ui`, org-chart engine, import flow, benchmark pattern ไว้

---

## 5. Database Schema (finalized — พร้อม apply)

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
-- By Banner tree   : traverse where dimension='banner'
-- By Function tree : traverse where dimension='function' (subset)
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

**Computed fields (ไม่เก็บ — คำนวณตอน query/render):**
- Years of Service ← `hire_date`
- Years in Position ← `position_effective_date`
- Team Size / Direct Reports ← count `org_edges` (dimension='banner', parent = employee)
- Current Performance ← latest row ใน `performance_grades`

**RPC ที่น่าจะต้องสร้าง (ภายหลัง):**
- `get_org_tree(p_dimension text, p_root bigint)` → tree สำหรับ By Banner / By Function
- `get_comparison_data(p_employee_ids bigint[])` → ดึงข้อมูลเทียบหลายคนทีเดียว
- (หรือทำ client-side แบบ benchmark pattern ก็ได้ ถ้า data ไม่ใหญ่)

---

## 6. Data Input Process (ออกแบบ 3 ทาง)

ข้อมูลเป็น HR sensitive (GDPR/PDPA) → ออกแบบให้ปลอดภัย + ทำซ้ำได้:

### A. Bulk Import (ทางหลัก — initial load + dummy data)
- Excel/CSV template 1 sheet ต่อ entity: `employees`, `compensation`, `performance`, `comp_history`
- คอลัมน์ `manager_employee_id` ใน sheet employees → ระบบสร้าง `org_edges` (dimension='banner') อัตโนมัติ
- (อีกคอลัมน์ `function_manager_employee_id` → org_edges dimension='function')
- **Reuse:** `processCsvUpload` + Papa parse + preview table ก่อน commit
- **Validation:** manager_id มีจริง, FY ไม่ซ้ำ, currency valid, ไม่มี cycle ใน org

### B. Manual Form (แก้รายคน)
- Reuse โครง `candidate-edit-form` → แตกเป็น tab: Personal / Compensation / Performance / Insights
- เพิ่ม performance grade ทีละปี, เพิ่ม salary adjustment record

### C. AI Insight (ปุ่มในหน้า Profile)
- กดปุ่ม → ส่ง comp + performance + tenure + org context ให้ Claude → generate Key Insights (3 categories)
- user override/แก้เองได้ (`source` flag: ai | manual)

**ลำดับ rollout การ input:** Banners/Functions master → Employees (+manager) → Compensation → Performance/History → Insights

---

## 7. Dummy Data Spec (ชุดแรก — Decision D5)

generate เพื่อ test flow ทั้งระบบ (อ้างอิงตัวละครใน mockup):

**Employees (~5–7 คน):**
- Alex Morgan — Senior Product Manager, banner=Global Solutions Ltd., Spain, hire 2018, comp €160k, perf B+, readiness High, team 6
- Sofia Martines — HR Director
- Daniel Lee — Finance Manager
- Emma Rossi — Marketing Lead
- Michael Tan — Operations Manager
- + line managers (เช่น VP Product เหนือ Alex) เพื่อให้ org tree มีระดับ
- + Global HR Director / Regional HR Leads เพื่อ test By Function tree

**ครอบคลุม:**
- หลายประเทศ (Spain HQ, France, Germany, Italy, Singapore, Thailand, Australia) → test By Banner map
- Performance 5 ปี (FY2021–2025) ต่อคน
- Compensation history 3 ปี ต่อคน
- org_edges ทั้ง banner + function dimension
- อย่างน้อย 1 คน status='Resigned' เพื่อ test filter

---

## 8. Supabase MCP Setup (Claude Desktop / VS Code)

> Royal Flush ใช้ Supabase **project แยก คนละ org** กับ CGTalentHub — token ของ CGTalentHub เข้าไม่ถึง ต้องตั้ง MCP ใหม่

**Claude Desktop config:**
- Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "supabase-royalflush": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--project-ref=<PROJECT_REF_ROYALFLUSH>"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "<PERSONAL_ACCESS_TOKEN_ORG_ใหม่>"
      }
    }
  }
}
```

- `--project-ref` lock ให้แตะได้แค่ project Royal Flush เท่านั้น (กันพลาดไปแตะ CGTalentHub)
- token สร้างที่ supabase.com/dashboard/account/tokens (เลือก org ใหม่)
- project ref ดูที่ Settings → General → Reference ID
- **restart Claude Desktop** หลังแก้ config
- ⚠️ **อย่า commit token ลง git** — config นี้อยู่นอก repo อยู่แล้ว

**สำหรับ VS Code (Claude Code extension):** ใช้ `.mcp.json` ที่ root ของ repo `RoyalFlush_ATS` ได้ (scope ตาม folder) — แต่ **อย่า commit token** ใส่ผ่าน env var แทน

---

## 9. Environment Variables (Vercel + local)

ตั้งใน `.env.local` (dev) และ Vercel (prod) ของ project ใหม่:
```
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # admin client
ANTHROPIC_API_KEY=<key>                        # ใช้ร่วมกับ CGTalentHub ได้
```

---

## 10. ลำดับงาน (Build Order)

| # | งาน | depends on |
|---|---|---|
| 1 | ตั้ง Supabase MCP ใหม่ (หัวข้อ 8) + apply schema (หัวข้อ 5) | — |
| 2 | Seed dummy data (หัวข้อ 7) | 1 |
| 3 | ตั้ง env vars + เชื่อม Supabase client ใน repo ใหม่ | 1 |
| 4 | Cleanup — ลบ feature CGTalentHub ที่ไม่ใช้ (ดูหัวข้อ 4) | — |
| 5 | หน้า **Employee Profile** (reuse `candidates/[id]`) | 2,3 |
| 6 | หน้า **Employee Comparison** (reuse benchmark pattern) + Export HTML | 5 |
| 7 | หน้า **Org By Banner** + **By Function** (reuse org-chart engine) | 2,3 |
| 8 | ปุ่ม **AI Insight** (Anthropic) | 5 |
| 9 | **Data input** — bulk import + manual form (หัวข้อ 6) | 3 |
| 10 | Rebrand UI: "CG Talent Hub" → "Royal Flush" | — |

**เริ่มที่ #1 → #2 → #5** จะเห็นผลเร็วสุด (มี profile ที่มีข้อมูลจริงให้ดู)

---

*Last updated: 2026-06-23 | Royal Flush ATS Design v1 — handoff from CGTalentHub session*
