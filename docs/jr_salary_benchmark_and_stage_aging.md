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

*Created: 2026-09-16 | JR Salary Benchmark & Stage Aging v1*
