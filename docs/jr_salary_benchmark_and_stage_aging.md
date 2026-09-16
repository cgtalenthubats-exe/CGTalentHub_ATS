# JR Salary Benchmark & Stage Aging

> **STATUS: สร้างแล้วใน branch `claude/jr-salary-benchmark-stage-aging-womqgi`** — ยังไม่ merge
> ⚠️ ต้องรัน migration 1 ไฟล์ก่อนถึงจะใช้ได้ครบ (ดูหัวข้อ 0)
> อ่านไฟล์นี้ก่อนแตะ Salary Benchmark tab หรือ Stage Aging ใน `/requisitions/manage`

---

## 0. ต้องทำก่อน — รัน migration

`supabase/migrations/20260916000000_add_jr_budget_and_stage_owner.sql`

```sql
alter table public.job_requisitions
    add column if not exists budget_min  numeric,
    add column if not exists budget_max  numeric,
    add column if not exists budget_note text;

alter table public.status_master
    add column if not exists owner_role text;
```

**ผมรันเองไม่ได้** — session นี้ไม่มี DB credential → ต้องรันใน Supabase SQL Editor เอง
ถ้ายังไม่รัน: หน้าจอยังเปิดได้ปกติ แต่จะขึ้นแถบเตือนสีเหลือง และกดบันทึก budget / ตั้ง owner ไม่ได้ (ข้อความ error จะบอกชื่อไฟล์ migration ให้)

---

## 1. Salary Benchmark — ข้อมูลที่ใช้

### มีอะไรให้ใช้จริง

| แหล่ง | field | ใช้ทำอะไร |
|---|---|---|
| `Candidate Profile` | `gross_salary_base_b_mth` | **เงินเดือนพื้นฐานต่อเดือน (THB)** — ตัวเลขหลักของทั้งหน้า |
| `Candidate Profile` | `bonus_mth` | โบนัส (จำนวนเดือน) — แสดงแยก ไม่รวมเข้าเงินเดือนพื้นฐาน |
| `candidate_experiences` | `position_keyword`, `is_current_job`, `company_id`, `country` | หา cohort + segment |
| `company_master` | `rating` | breakdown ตามระดับดาวโรงแรม |
| `country` | `region` | breakdown ตามภูมิภาค |
| `employment_record` | `base_salary`, `position`, `bu`, `hire_date` | **"เราเคยจ่ายจริงเท่าไหร่"** |
| `position_keyword_vocab` | `keyword`, `aliases` | แปลงชื่อตำแหน่งใน JR → keyword |
| `job_requisitions` | `budget_min/max/note` ← **ของใหม่** | budget ของ JR |

### สิ่งที่ตัวอย่าง (Centara mockup) มี แต่เราไม่มี

- **Market survey ภายนอก (Mercer / Hays)** — ไม่มี data source → เราใช้ฐานข้อมูล candidate ของเราเองแทน หน้าจอเขียนกำกับไว้ชัดว่า *"internal data, not a published salary survey"* จะได้ไม่เอาไปอ้างผิด
- **Benefit benchmark** (housing / transport / provident fund เป็น % ของเงินเดือน) — เรามีแค่ `bonus_mth` อย่างเดียว → ยังทำไม่ได้ ถ้าอยากได้ต้องเก็บ field พวกนี้เพิ่มที่ candidate profile ก่อน
- **Sample size ต่อ location แบบ survey** — เรามี sample size ของเราเอง (นับจาก candidate จริง) ซึ่งตรงไปตรงมากว่า

### "Market" ในหน้านี้หมายถึงอะไร

cohort = candidate ที่ **ตำแหน่งปัจจุบันตรงกับ position keyword ของ JR นี้** และมี `gross_salary_base_b_mth` กรอกไว้

1. เอา `position_jr` ของ JR ไปเทียบกับ `position_keyword_vocab` (keyword + aliases) → ได้ชุด keyword
2. หา candidate ที่ experience ปัจจุบัน (`is_current_job = 'Current'`) มี `position_keyword` อยู่ในชุดนั้น (cap 3,000 คน)
3. ดึงเงินเดือนของคนกลุ่มนั้นมาคำนวณสถิติ

หน้าจอแสดง keyword ที่ match ไว้ให้เห็นเลย — user จะได้รู้ว่า "market" ที่เห็นมาจากนิยามไหน ไม่ใช่กล่องดำ

---

## 2. Salary Benchmark — ที่สร้างไว้

ไฟล์: `src/app/actions/jr-salary-benchmark.ts` · `src/app/requisitions/manage/SalaryBenchmarkTab.tsx`

| ส่วน | รายละเอียด |
|---|---|
| **Summary cards 5 ใบ** | Market Median · Market Range (P25–P75) · Market Min–Max (+n) · Our Budget (+% เทียบ median) · Budget Position (percentile) |
| **Salary Positioning bar** | ← สิ่งที่ขอ — แถบ min–max + แถบ P25–P75 + เส้น median + จุด budget (เขียว/แดงตามว่าต่ำกว่า P25 มั้ย) ถ้ากรอก budget เป็นช่วงจะวาดเป็นช่วงให้ด้วย |
| **Salary Distribution** | ← กราฟระฆัง — histogram ของ cohort, แท่งที่ budget ตกอยู่จะเป็นสีเขียว ขนาด bucket ปรับตามการกระจายของข้อมูล (ตัด outlier บนสุด 2% ตอนคำนวณ bucket ไม่งั้นคนเงินเดือน 900k คนเดียวจะทำให้กราฟแบนหมด) |
| **What this means** | แปลผลอัตโนมัติจาก percentile — budget ต่ำกว่า median กี่ % · มีคนกี่ % ที่ได้มากกว่า budget · median ของคนใน JR นี้ |
| **By Hotel Star Rating / By Region** | ตาราง median / P25 / P75 / sample (ตัด segment ที่ n < 3 ทิ้ง ไม่งั้น median จากคนเดียวจะดูเหมือนข้อมูลจริง) |
| **Candidates in this JR** | ตารางเงินเดือนรายคน + **vs Budget** (บวก = ตอนนี้เขาได้มากกว่า budget เรา) ← มาแทน column เดิมที่ user บอกว่าขาด budget |
| **What we actually paid** | placement ล่าสุดของตำแหน่งใกล้เคียงจาก `employment_record` |
| **ปุ่ม Set/Edit budget** | dialog กรอก min / max (max ไม่บังคับ) / note |

**หน่วยที่ใช้**: เงินเดือนพื้นฐานต่อเดือน (THB) ทั้งหน้า — ตรงกับที่ recruiter คุยกันจริง และตรงกับ field ใน DB
ของเดิมแสดงเป็น "฿M ต่อปี" ซึ่งต้องแปลงในหัวตลอด → เปลี่ยนแล้ว

**ของเดิมที่เอาออก**: กราฟแท่ง "Market Salary Benchmark (฿M)" ที่ group ตามบริษัท/ตำแหน่ง — อ่านยาก ไม่มี budget ให้เทียบ และ `getJRSalaryStats()` ที่อยู่เบื้องหลังเรียก `getMarketSalaryStats()` มาแล้วทิ้งผลทั้งก้อน (ลบทิ้งแล้ว พร้อม scratch script ที่ debug มันตัวเดียว)

---

## 3. Stage Aging — ข้อมูลที่ใช้

**ข่าวดี: engine มีอยู่แล้ว** `getJRAnalytics()` คำนวณเวลาที่ candidate อยู่ในแต่ละ status จาก `status_log` (ช่วงห่างระหว่าง log สองอันติดกัน, อันสุดท้ายนับถึงตอนนี้) ได้ avg / min / max / จำนวนครั้งอยู่แล้ว

ของใหม่ (`src/app/actions/jr-stage-aging.ts`) ใช้ logic เดียวกัน แต่ตอบคนละคำถาม:

> ของเดิมตอบ **"ปกติ stage นี้ใช้เวลาเท่าไหร่"** (ข้อมูลย้อนหลัง)
> ของใหม่ตอบ **"ตอนนี้ค้างอยู่ตรงไหน ใครค้าง ค้างมากี่วัน"** (ข้อมูลสด)

ซึ่งอันหลังคือคำถามที่ recruiter เปิดหน้านี้มาเพื่อหาคำตอบ

| ต้องการ | มาจากไหน |
|---|---|
| ลำดับ stage | `status_master.stage_order` |
| candidate อยู่ stage ไหนตอนนี้ | `status_log` รายการล่าสุดของแต่ละคน |
| รอมากี่วัน | now − timestamp ของ log ล่าสุด |
| ใครเป็นคนเปลี่ยนล่าสุด | `status_log.updated_by` |
| Total open days | `getJRAgingDays(request_date, closed_date)` (มีอยู่แล้ว) |
| **Owner ของ stage** | `status_master.owner_role` ← **ของใหม่** ตั้งใน Settings → Status Master |

---

## 4. Stage Aging — ที่สร้างไว้

ไฟล์: `src/app/actions/jr-stage-aging.ts` · `src/app/requisitions/manage/StageAgingPanel.tsx` · `src/lib/stage-aging.ts`

| ส่วน | รายละเอียด |
|---|---|
| **Stat cards** | Total Open Days · Active Candidates (+จำนวนที่จบแล้ว) · Longest Wait · Stages In Play |
| **Waiting Days by Owner** | แสดงเมื่อตั้ง `owner_role` แล้ว — รวมวันที่รออยู่ แยกตาม TA / Hiring Team / Candidate ← ตรงกับ 3 การ์ดบนสุดในตัวอย่าง |
| **Current Bottleneck banner** | stage ที่มีคนรอนานที่สุด (≥ 7 วัน) + จำนวนคนรอ + owner · ถ้าไม่มีใครค้างเกิน 7 วันจะขึ้นแถบเขียวแทน |
| **Stage Flow** | การ์ดเรียงตาม `stage_order` → เลขใหญ่ = วันที่รอนานสุดใน stage นั้น, บรรทัดล่าง = มีกี่คนอยู่ + avg ย้อนหลัง, pill สีบอกความรุนแรง |
| **Who is waiting** | ตาราง candidate: stage ปัจจุบัน / owner / waiting since / aging / status / คนที่เปลี่ยนล่าสุด — เรียงคนรอนานสุดขึ้นก่อน, ซ่อนคนที่จบแล้วไว้ (กดดูได้) |

**เกณฑ์สี** (`src/lib/stage-aging.ts` แก้ที่เดียว): Attention 7 วัน · Delayed 14 วัน · Critical 21 วัน
**Terminal status** (Successful Placement / Rejected / Not fit / ...) ไม่นับเป็นการรอ — คนที่จบแล้วจะไม่ไปโผล่เป็น "Critical" และไม่ทำให้ banner เตือนผิด

---

## 5. UI ที่ปรับในหน้า `/requisitions/manage`

| เดิม | ใหม่ | เหตุผล |
|---|---|---|
| กราฟแท่ง "Avg. Aging (Days)" ซ่อนอยู่ใน accordion "Activity Transaction & Aging" | **ลบ** แล้วใส่ Stage Aging panel เป็น section หลัก **เหนือ** accordion (เห็นทันทีที่เปิด JR) | bottleneck คือสิ่งที่ต้องเห็นทุกวัน ไม่ควรต้องกดเปิด · ค่า avg ย้อนหลังยังอยู่ (ไปอยู่บนการ์ดแต่ละ stage) |
| accordion ชื่อ "Activity Transaction & Aging" | เปลี่ยนชื่อเป็น "Activity Transaction" | เหลือแค่กราฟ transaction จริงๆ |
| Salary tab = กราฟแท่ง ฿M/ปี + CandidateList ซ้ำกับ List tab | Salary tab ใหม่ทั้งหน้า | CandidateList ซ้ำกับ tab List อยู่แล้ว · ตารางใหม่โฟกัสที่การเทียบกับ budget |
| Settings → Status Master | เพิ่ม column **Stage Owner** (TA / Hiring Team / Candidate / Unassigned) | เปิดใช้ Waiting Days by Owner |

---

## 6. ข้อจำกัดที่ควรรู้ (ไม่ใช่ bug)

- **ยังไม่ได้ทดสอบกับข้อมูลจริง** — session นี้ไม่มี DB credential รันได้แค่ `next build` (ผ่าน) ตัวเลขที่ออกมาต้องเช็คกับ JR จริงอีกรอบ
- **Cohort พึ่ง `position_keyword`** — JR ที่ชื่อตำแหน่งไม่ match vocab เลยจะไม่มี market data (หน้าจอบอกเหตุผลให้) แก้ได้โดยเพิ่ม keyword/alias ใน `position_keyword_vocab`
- **`gross_salary_base_b_mth` ไม่ได้กรอกครบทุกคน** — หน้าจอบอกตรงๆ ว่ามี n เท่าไหร่ และใน JR นี้กรอกแล้วกี่คนจากทั้งหมด
- **Placement matching หยาบ** — match ด้วยคำแรกของชื่อตำแหน่ง ถ้าอยากแม่นกว่านี้ต้อง map ตำแหน่งใน `employment_record` เข้า vocab เหมือนกัน
- **Stage owner ต้องตั้งเองครั้งแรก** — ถ้ายังไม่ตั้ง การ์ด Waiting Days by Owner จะไม่ขึ้น (ส่วนอื่นทำงานปกติ)

---

## 7. ต่อยอดได้อีก (ยังไม่ทำ)

1. เก็บ benefit ต่อ candidate (housing / transport / provident) → ทำ Benefit Benchmark แบบในตัวอย่างได้
2. บันทึก **expected salary** ของ candidate ตอน pre-screen → เทียบ "ที่เขาขอ" กับ "budget เรา" ได้ตรงกว่าใช้เงินเดือนปัจจุบัน
3. Stage Aging ระดับหลายๆ JR (หน้า pending-tasks) → เห็นว่าทั้งทีมติดตรงไหนบ่อยสุด
4. แจ้งเตือนเมื่อ candidate ค้าง stage เกินเกณฑ์ (ต่อกับ n8n ได้)

---

---

## 8. Stage Aging v2 — หลัง review กับ user (2026-09-17)

รอบแรกมีปัญหาที่ user จับได้ทันที: การ์ดหนึ่งเขียน `70d` อีกการ์ดเขียน `2` — เลขในช่องเดียวกันหมายถึงคนละอย่าง และ `avg 31d` ไม่ตรงกับพฤติกรรมของใครเลย

### 8.1 ปัญหาที่แก้

| ปัญหา | สาเหตุ | แก้ยังไง |
|---|---|---|
| เลขใหญ่ปนสองความหมาย | stage ปลายทางแสดง "จำนวนคน" ในช่องเดียวกับ "จำนวนวัน" | แยกเป็น 2 แถว — เส้นทางหลัก (วัน) กับ คนที่หลุดออก (คน) · ทุกเลขเขียนหน่วยกำกับ |
| `avg` ไม่ตรงกับใครเลย | เฉลี่ยรวมคนที่ผ่านไปแล้ว (0 วัน) กับคนที่ยังค้าง (70 วัน) | ใช้ **median เฉพาะคนที่ออกจาก stage ไปแล้ว** + บอก n |
| `avg` ไต่ขึ้นเองทุกวัน | นับคนที่ยังค้างถึง "วันนี้" ตลอด | คนที่ยังค้างไม่เข้าสถิติ "ปกติใช้กี่วัน" อีกต่อไป |
| คอขวดชี้ผิดตัว | กฎ "รอนานสุด" ทำให้ชี้ Pool Candidate ซึ่งเป็น longlist ที่ยังไม่ติดต่อ | Pool เป็น **holding** — ไม่นับเป็นคอขวด ไม่คิดสถิติเวลา |
| มองไม่เห็นว่าไปได้ไกลแค่ไหน | stage ที่ยังไม่มีใครถึงถูกซ่อน | แสดง stage ข้างหน้าแบบจาง + KPI "Reached Step 6 / 8" |
| ไม่รู้ว่าเลขมาจากไหน | ไม่มีคำอธิบาย | ปุ่ม **What the numbers mean** กางอธิบาย 6 หัวข้อ |

### 8.2 ความหมายของสองตัวเลข (ห้ามสับสน)

| | นับจาก | จบยัง | เปลี่ยนมั้ย |
|---|---|---|---|
| **No movement for N days** | เปลี่ยนสถานะล่าสุด → วันนี้ | **ยังไม่จบ** | โตขึ้นทุกวัน |
| **Usually N days (n=x)** | เข้า stage → ออกจาก stage | จบแล้ว | นิ่ง |

### 8.3 ลำดับใน "Needs attention"

เรียงตาม **stage ที่ลึกที่สุดก่อน** ไม่ใช่เรียงตามจำนวนวัน — เพราะเร่ง stage ต้นทางให้ตายก็แค่ดันคนเพิ่มเข้าไปในท่อที่ตันอยู่ข้างหน้า แต่ปลด stage ที่ใกล้ปลายทางได้ = ได้ placement

ตัวอย่าง JR000235: Interview Completed (2 คน / 30 วัน) ขึ้นก่อน Approached (11 คน / 70 วัน)

### 8.4 กราฟเดิมกลับมาแล้ว

`Activity Transaction & Aging` ย้ายไปเป็น **tab ในแถวหลัก** (List View · Pipeline · History Insights · **Activity & Aging** · Salary Benchmark · AI Suggestion) ไม่ใช่ accordion แยกข้างบนแล้ว · ข้างในมี 2 sub-tab:
- **Activity Transaction** — จำนวนครั้งที่เข้าแต่ละสถานะ
- **Avg. Aging (Days)** — ค่าเฉลี่ยย้อนหลังแบบเดิม พร้อมหมายเหตุว่ามันรวมคนที่ยังค้างอยู่ด้วย ต่างจากแผง Stage Aging ข้างบน

ตาราง **Who is waiting** ถูกเอาออกตามที่ user ขอ (ยาวเกินไป)

### 8.5 ค่าคงที่ที่แก้ได้ (`src/lib/stage-aging.ts`)

```ts
STAGE_THRESHOLDS = { attention: 7, delayed: 14, critical: 21 }
HOLDING_STATUSES = { "Pool Candidate" }          // ไม่นับเป็นคอขวด
TERMINAL_STATUSES = { "Successful Placement", "Rejected", ... }
HIDDEN_STATUSES  = { "Interview Scheduled - ..." }  // ซ่อนจาก flow และกราฟ
```

ถ้าวันหนึ่งอยากให้ตั้งค่าจากหน้าเว็บ ย้ายไป `status_master` เป็น column `stage_kind` ได้ — โครงรองรับไว้แล้ว

### 8.6 ที่พบระหว่างทาง — ยังไม่แก้

**ไม่มี status "รอ HM ตัดสินใจหลังสัมภาษณ์"** — `Received HM Feedback` (ลำดับ 5) อยู่**ก่อน** interview (เป็น feedback ต่อ CV) พอสัมภาษณ์เสร็จแล้วทางเดียวที่ขยับได้คือ `Offer` หรือ `Not Pass Interview`
→ `Interview Completed` เลยทำหน้าที่ห้องรอไปโดยปริยาย ซึ่งเป็นเหตุผลที่ 2 คนค้างอยู่ 30 วัน
→ เลือกได้: เพิ่ม status ใหม่แทรกระหว่าง 6-7 หรือปล่อยไว้แล้วอ่านการ์ดว่า "รอ HM"

**`status_log.timestamp` เก็บแค่วันที่ ไม่มีเวลา** → เปลี่ยน 2 ครั้งในวันเดียว = 0 วัน (น่าจะเป็นที่มาของคนที่ "ผ่าน Pool ภายในวันเดียว") ยังไม่ได้แยกนับ same-day ออกจากสถิติ

---

---

## 9. Salary Benchmark v2 — หลัง review กับ user (2026-09-17)

| feedback | ทำอะไร |
|---|---|
| ขอ ⓘ อธิบายว่า median / range มาจากไหน | ปุ่ม **What the numbers mean** — อธิบาย 6 หัวข้อ: “market” หมายถึงฐานข้อมูลเราเองไม่ใช่ survey, median, P25–P75, budget percentile, n, และว่าทุกเลขเป็น **basic salary ต่อเดือน** ไม่รวมโบนัส |
| Salary Distribution ไว้ดูอะไร | **ใช่ — นับหัวคน** ต่อช่วงเงินเดือน · ใส่ label แกน Y ว่า `candidates` และแก้คำบรรยายให้ตรง |
| Positioning + What this means แบนไป | `min-h-[340px]` ทั้งสองใบ + padding เพิ่ม + คำอธิบายใต้หัวข้อ |
| ถ้า JR ไม่ใช่โรงแรมล่ะ | ถ้า cohort มี star rating **น้อยกว่า 2 กลุ่ม** จะสลับไปแสดง **Market Salary by Industry** แทนอัตโนมัติ (ดึง industry จาก `candidate_experiences.company_industry` → fallback `company_master.industry`) |
| ตาราง candidate ขอ filter + chip | search (ชื่อ/ตำแหน่ง/บริษัท) · ปุ่ม rating (multi-select) · ปุ่ม Has salary — ทุกอันมี **chip ลบออกได้** + Clear all + นับ “N of M shown” แบบเดียวกับหน้า list |
| ขอ sorting | เรียงได้ที่ Candidate / Current Position / Rating / Monthly Base / Bonus (กดหัวคอลัมน์ สลับขึ้น-ลง) |
| filter มีผลกับกราฟข้างบนมั้ย | **ไม่มีผล — ตั้งใจ** เขียนกำกับไว้บนตาราง: กราฟข้างบนอธิบาย “ตลาด” (candidate ทั้ง DB ที่ตรงตำแหน่ง) ส่วนตารางคือ “คนใน JR นี้” ถ้า filter แล้วกราฟขยับด้วยจะอ่านไม่ออกว่าเลขไหนพูดถึงกลุ่มไหน |
| ขาด current position | เพิ่มคอลัมน์ **Current Position** (บริษัทย้ายไปเป็นบรรทัดรองใต้ชื่อ แบบหน้า list) |
| ขอให้เหมือนหน้า list view | เพิ่ม **รูป candidate** (`CandidateAvatar`) และ **ปุ่ม candidate_id กดแล้วเปิด `JRCandidateSheet`** ด้านข้าง — ดู benefit อื่นๆ ได้จากในนั้น |
| What we actually paid | **เอาออกแล้ว** ทั้ง UI และ query (`employment_record`) — กู้จาก git history ได้ถ้าอยากได้คืน |

### ยังไม่ได้ทำ
- Filter ที่ตารางยังไม่ผูกกับกราฟ (ตามที่อธิบายไว้ข้างบน) ถ้าอยากได้จริงควรทำเป็น toggle แยก เช่น “คำนวณ market จากกลุ่มที่ filter ไว้”
- Benefit Benchmark — รอข้อมูลสวัสดิการที่เพิ่งเปิดให้กรอกสะสมก่อน

---

---

## 10. Salary Benchmark v3 — เปลี่ยน scope เป็น "เฉพาะ JR นี้" (2026-09-17)

### สิ่งที่ผิดในเวอร์ชันก่อน

ผมออกแบบตอบผิดคำถาม — v1/v2 ดึง candidate **ทั้ง database** ที่ตำแหน่งปัจจุบันตรงกับ position keyword ของ JR มาเป็น "market"

แต่สิ่งที่ user ต้องการคือ **เทียบ budget กับกลุ่มคนที่เราเลือกมาใน JR นี้**

ผลคือ JR000235 ซึ่ง **ไม่มีใครใน 32 คนมีข้อมูลเงินเดือนเลย** กลับแสดง median ฿270,000 · 5 Star ฿392,000 · 4 Star ฿290,000 — ตัวเลขจริง แต่มาจากคนนอก JR ทั้งหมด ซึ่งอ่านแล้วเข้าใจว่าเป็นของคนใน pool

### v3 ทำอะไร

| ส่วน | เปลี่ยนเป็น |
|---|---|
| **แหล่งข้อมูล** | เฉพาะ candidate ใน `jr_candidates` ของ JR นี้ ที่มี `gross_salary_base_b_mth` — **ไม่มีคนนอก JR เลย** |
| ชื่อการ์ด | Market Median → **Pool Median** · Market Range → **Pool Range** · ตาราง breakdown → **Pool Salary by ...** |
| คำอธิบายใต้หัวข้อ | บอกตรงๆ ว่า "across the N of M candidates in this JR who have one on their profile. Nobody outside this JR is included." |
| Empty state | "None of the 32 candidates in this JR has a salary on file yet — Fill in Base Salary (Gross) on a candidate's profile" + ยังแสดงตารางรายชื่อไว้ให้กดเข้าไปกรอกได้ |
| ⓘ glossary | เขียนใหม่ทั้งหมด หัวข้อแรกคือ **Which candidates** อธิบาย scope ก่อนเลย |
| Breakdown ตาม rating / industry / region | ยังอยู่ แต่คำนวณจาก pool และต้องมีอย่างน้อย **3 คน** ต่อกลุ่มถึงจะขึ้น |

### ที่ลบออก (ง่ายขึ้นเยอะ)

- การ match `position_keyword_vocab` ทั้งหมด
- query candidate ทั้ง DB (cap 3,000 คน) — ตอนนี้ query แค่คนใน JR ซึ่งเร็วกว่ามาก
- field `market`, `pipeline`, `cohortKeywords`, `dataQuality.marketSampleSize`

### Market-wide view ไปไหน

ตกลงกันว่า**ภาพรวมทั้งระบบเก็บไว้ทำใน Dashboard** พร้อม filter เต็มระบบ ไม่ใช่ในหน้า JR
โค้ดเดิม (keyword matching + cohort query) ยังอยู่ใน git history ที่ commit `07dfa86` เอากลับมาใช้เป็นฐานได้

---

*Created: 2026-09-16 | JR Salary Benchmark v3 & Stage Aging v2*
