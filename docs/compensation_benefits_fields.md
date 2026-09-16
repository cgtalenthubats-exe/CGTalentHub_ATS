# Compensation & Benefits Fields — สำรวจ + แผนการแก้ (รอ confirm)

> **STATUS: สำรวจแล้ว ยังไม่แก้โค้ด** — branch `claude/compensation-benefits-plan-womqgi`
> อ่านไฟล์นี้ก่อนแตะฟอร์มกรอกเงินเดือน/สวัสดิการ ทุกครั้ง — field เดียวถูกใช้ใน **13 ไฟล์**

---

## 1. ตอนนี้มีอะไรอยู่

ทุก field อยู่บนตาราง `Candidate Profile` (ไม่มีตารางแยกสำหรับ benefit)

| # | Column | Label ที่ user เห็น | ชนิด (ตามที่โค้ดใช้งาน) | หมายเหตุ |
|---|---|---|---|---|
| 1 | `gross_salary_base_b_mth` | Salary (฿/M) | text → `parseFloat` ตอนใช้ | **ไม่มีที่ไหนบอกว่าเป็น gross** |
| 2 | `bonus_mth` | Bonus (Months) | text | หน่วยเป็น "จำนวนเดือน" |
| 3 | `other_income` | Other Income (placeholder "Allowances...") | text อิสระ | น่าจะคือตัวที่เรียกว่า "other allowance" |
| 4 | `car_allowance_b_mth` | Car (฿/M) | text ตัวเลข | |
| 5 | `gasoline_b_mth` | Gas (฿/M) | text ตัวเลข | |
| 6 | `phone_b_mth` | Phone (฿/M) | text ตัวเลข | |
| 7 | `provident_fund_pct` | PFund (%) | text | กรอกได้อย่างเดียว — ไม่มีวิธีบอกว่า "มี แต่ไม่รู้ %" |
| 8 | `medical_b_annual` | Medical (฿/Yr) | text ตัวเลข | |
| 9 | `medical_b_mth` | Medical (฿/M) | text ตัวเลข | ← ที่จะเปลี่ยนเป็น Dental |
| 10 | `insurance` | Insurance | text เก็บเป็น CSV เช่น `"Self, Immediate family"` | multi-select 3 ตัวเลือก |
| 11 | `housing_for_expat_b_mth` | Housing / Expat (placeholder "Notes...") | text อิสระ | ชื่อ column บอกว่าเป็นตัวเลข/เดือน แต่ UI ให้พิมพ์ note |
| 12 | `others_benefit` | Additional Benefits Pool (Other Benefits) | textarea | ← ที่จะเปลี่ยนเป็น Note |

**ข้อสังเกตสำคัญ**
- เก็บเป็น **text หมด** (โค้ด `parseFloat` / `parseSalary` เอาเอง) เพราะข้อมูลชุดแรกมาจาก CSV import
- format ตัวเลข (ใส่คอมม่า) ทำแค่ **6 field** เท่านั้น: `gross_salary_base_b_mth`, `car_allowance_b_mth`, `gasoline_b_mth`, `phone_b_mth`, `medical_b_annual`, `medical_b_mth` → ที่เหลือพิมพ์อะไรก็ได้ ← ตรงกับที่บอกว่า "ขอ fix เลขทุกกล่อง"
- **ไม่มีที่ไหนแยกได้ว่า "ไม่มีสวัสดิการนี้" กับ "มีแต่ไม่รู้ตัวเลข"** — ทั้งคู่กลายเป็นค่าว่างเหมือนกัน

---

## 2. แก้แล้วกระทบที่ไหนบ้าง — 13 ไฟล์

### 2.1 ฟอร์มกรอก (3 ที่ — ต้องแก้ให้ตรงกันทั้งหมด)

| ไฟล์ | ใช้ที่ไหน |
|---|---|
| `src/components/candidate-edit-form.tsx` | หน้าแก้ไข candidate (ฟอร์มหลัก 12 ช่อง) |
| `src/components/candidate-financial-edit-section.tsx` | แก้แบบ inline ใน sheet |
| `src/app/candidates/new/page.tsx` | สร้าง candidate ใหม่ |

**นี่คือปัญหาเชิงโครงสร้าง**: field list ถูกเขียนซ้ำ 3 รอบ (+ default values + list ของ field ที่ต้อง format ตัวเลข) ถ้าเพิ่ม 6 กล่องใหม่ตามที่ขอ ต้องไปแก้ 3 ที่ทุกครั้ง และมันเริ่ม drift แล้ว (เช่น `new/page.tsx` format ตัวเลขแค่ 4 field ส่วน edit-form format 6 field)

### 2.2 ทางเขียนลง DB (2 ที่ — มี **whitelist** ต้องเพิ่มชื่อ field ใหม่ ไม่งั้นข้อมูลหาย**เงียบๆ**)

| ไฟล์ | จุดที่ต้องแก้ |
|---|---|
| `src/app/api/candidates/[id]/route.ts` | `compensationFields` array (บรรทัด ~346) — field ที่ไม่อยู่ในนี้จะถูกโยนทิ้งโดยไม่ error |
| `src/app/api/candidates/create/route.ts` | insert payload เขียนชื่อ field ตรงๆ |

### 2.3 ทางแสดงผล (5 ที่)

| ไฟล์ | แสดงอะไร |
|---|---|
| `src/components/candidate-preview-sheet.tsx` | การ์ด Financial Profile & Benefits |
| `src/app/candidates/[id]/page.tsx` | หน้า candidate detail |
| `src/app/dashboard/PackageInfoTab.tsx` | ตาราง benefit เทียบรายบริษัท — มี `BENEFIT_ROWS` ที่ hardcode 11 แถว |
| `src/app/actions/benchmark-actions.ts` | type `BenchmarkCandidate` + `select(...)` — ต้องเพิ่มชื่อ column ทั้งสองที่ |
| `src/app/actions/dashboard.ts` | สถิติเงินเดือน |

### 2.4 ทางเข้าข้อมูลอัตโนมัติ (2 ที่)

| ไฟล์ | หมายเหตุ |
|---|---|
| `src/app/api/n8n/callback/route.ts` | เขียนแค่ `gross_salary_base_b_mth` จาก `LatestSalary` |
| `src/app/api/ai/parse-candidate/route.ts` + `candidates/new/page.tsx` | AI อ่านเรซูเม่แล้ว map เข้า `compensation.*` — ถ้าอยากให้ AI ดึง field ใหม่ด้วยต้องเพิ่ม prompt/schema |

### 2.5 กระทบงานที่เพิ่งทำไป

| งาน | กระทบมั้ย |
|---|---|
| **JR Salary Benchmark** (`jr-salary-benchmark.ts`) | ใช้แค่ `gross_salary_base_b_mth` + `bonus_mth` → **ไม่กระทบ** ถ้าไม่แตะสองตัวนี้ · และถ้ามี field ใหม่ครบ จะ**ทำ "Benefit Benchmark" แบบในตัวอย่าง Centara ได้จริง** (ตอนนี้ผมเขียนไว้ว่าทำไม่ได้เพราะไม่มีข้อมูล) |
| Stage Aging | ไม่เกี่ยวเลย |
| Search suggestions / refresh fixes | ไม่เกี่ยวเลย |

---

## 3. สิ่งที่ขอมา → แผนการทำ

### 3.1 ที่ชัดเจนแล้ว ทำได้เลย

| ข้อที่ขอ | วิธีทำ | กระทบข้อมูลเดิม |
|---|---|---|
| remark ว่าเป็น **gross** | เปลี่ยน label เป็น `Base Salary (Gross, ฿/M)` + helper text ใต้ช่อง | ไม่มี |
| **provident ให้คลิกได้** (รู้ว่ามีแต่ไม่รู้เงิน) | เพิ่ม column ใหม่ `provident_fund_provided boolean` + checkbox "มี Provident Fund" · ถ้ารู้ % ค่อยกรอกในช่องเดิม | ไม่มี (ค่าเดิมยังอยู่) |
| **fix เลขทุกกล่อง** | ทำ input ตัวเลขตัวเดียวใช้ร่วมกันทุกช่อง (คอมม่าอัตโนมัติ, บล็อกตัวอักษร, `inputMode="numeric"`) แล้วเปลี่ยนทุกช่องเงินมาใช้ | ไม่มี — แต่ค่าเก่าที่พิมพ์ตัวอักษรปนไว้จะถูกตัดตอนกดบันทึกครั้งถัดไป |
| **other benefit → Note** | เปลี่ยน label `others_benefit` เป็น "Note" (คง column เดิม) | ไม่มี |
| **housing เอา expat ออก** | เปลี่ยน label เป็น "Housing" (คง column `housing_for_expat_b_mth`) · เสนอเปลี่ยนเป็นช่องตัวเลข ฿/เดือน + checkbox "provided" | ⚠️ ถ้าเปลี่ยนเป็นตัวเลข ค่าเดิมที่เป็นข้อความจะแสดงไม่ได้ → ต้องย้ายไปไว้ใน Note |
| **เพิ่ม meal allowance** | column ใหม่ `meal_allowance_b_mth` | ไม่มี |
| **เพิ่ม service charge / month** | column ใหม่ `service_charge_b_mth` | ไม่มี |
| **เพิ่ม IPD / OPD** | column ใหม่ `ipd_b_annual`, `opd_b_annual` | ไม่มี |
| **เพิ่ม education > เลือกกี่คน** | column ใหม่ `education_support_children int` (+ `education_support_b_annual` ถ้าต้องการวงเงิน) | ไม่มี |

### 3.2 ที่ต้องยืนยันก่อน (ตอบผิดแล้วข้อมูลเพี้ยน)

**① "medical month → dental"**
`medical_b_mth` ตอนนี้แปลว่า "ค่ารักษาพยาบาล ฿/เดือน" ถ้าเปลี่ยน label เป็น Dental เฉยๆ **ข้อมูลเก่าที่กรอกไว้จะกลายเป็นค่าทันตกรรมทันที** ทั้งที่ตอนกรอกไม่ได้หมายความแบบนั้น

เสนอ: สร้าง column ใหม่ `dental_b_annual` แล้ว**เลิกใช้** `medical_b_mth` (ซ่อนจากฟอร์ม แต่ไม่ลบข้อมูล) — ปลอดภัยกว่า rename
→ **ขอยืนยัน**: Dental เป็นวงเงิน **ต่อปี** หรือ **ต่อเดือน**?

**② "other allowance → annual leave"**
ในระบบ **ไม่มี field ชื่อ "Other Allowance"** มีแต่ **"Other Income"** (`other_income`) ที่ placeholder เขียนว่า "Allowances..."
→ **ขอยืนยัน**: หมายถึงตัวนี้ใช่มั้ย?
และ Annual Leave เป็น **จำนวนวันลา/ปี** (ไม่ใช่เงิน) → ควรเป็น column ใหม่ `annual_leave_days int` ไม่ใช่ rename ของเดิม (ข้อมูล Other Income เดิมจะกลายเป็นจำนวนวันทันที)

**③ IPD / OPD เก็บเป็นอะไร** — วงเงินบาท/ปี, จำนวนครั้ง, หรือแค่ ✓ มี/ไม่มี?

**④ Meal / Service charge** — เป็นจำนวนเงินต่อเดือน หรือเป็นแค่ ✓ (เช่น "มีอาหารพนักงานฟรี")?

**⑤ Education** — "เลือกกี่คน" คือจำนวนบุตรที่ได้สิทธิ์ใช่มั้ย และมีวงเงินต่อคนด้วยหรือเปล่า?

---

## 4. ข้อเสนอเชิงโครงสร้าง (สำคัญกว่าตัว field)

ตอนนี้จะเพิ่ม 1 field ต้องแก้ **8 จุดใน 6 ไฟล์**: ฟอร์ม 3 ที่ + whitelist API 2 ที่ + preview + dashboard row + benchmark select

**เสนอ: ประกาศ schema ที่เดียว** `src/lib/compensation-fields.ts`

```ts
export const COMPENSATION_FIELDS = [
  { key: 'gross_salary_base_b_mth', label: 'Base Salary (Gross)', unit: '฿/M',  type: 'money', group: 'salary',
    hint: 'กรอกเป็น gross ก่อนหักภาษีและประกันสังคม' },
  { key: 'service_charge_b_mth',    label: 'Service Charge',      unit: '฿/M',  type: 'money', group: 'salary' },
  { key: 'annual_leave_days',       label: 'Annual Leave',        unit: 'days', type: 'int',   group: 'leave'  },
  { key: 'provident_fund_pct',      label: 'Provident Fund',      unit: '%',    type: 'percent', group: 'benefit',
    hasProvidedFlag: 'provident_fund_provided' },
  ...
] as const;
```

แล้วให้ทุกที่ derive จากตัวนี้: ฟอร์มทั้ง 3 (render อัตโนมัติ), whitelist API (`COMPENSATION_FIELDS.map(f => f.key)`), preview, dashboard rows, benchmark select

**ผลลัพธ์**: เพิ่ม field ใหม่ครั้งถัดไป = แก้ไฟล์เดียว + migration และ 3 ฟอร์มจะไม่ drift กันอีก
ถ้าไม่ทำตอนนี้ การเพิ่ม 6 field ตามที่ขอจะทำให้ปัญหาโตขึ้นอีกเท่าตัว

---

## 5. Migration ที่ต้องรัน (ร่าง — รอ confirm ข้อ 3.2 ก่อน)

```sql
alter table public."Candidate Profile"
    add column if not exists service_charge_b_mth        numeric,
    add column if not exists meal_allowance_b_mth        numeric,
    add column if not exists dental_b_annual             numeric,
    add column if not exists ipd_b_annual                numeric,
    add column if not exists opd_b_annual                numeric,
    add column if not exists annual_leave_days           integer,
    add column if not exists education_support_children  integer,
    add column if not exists provident_fund_provided     boolean;
```

**หมายเหตุ**: column ใหม่ตั้งเป็น `numeric` (ของเดิมเป็น text) — ตั้งใจ เพราะของใหม่ไม่มีข้อมูลเก่าปนเปื้อน ส่วนของเดิมยังไม่แตะ (แปลง type ทีหลังเป็นงานแยก มีความเสี่ยงกับ CSV import)

---

## 6. ลำดับที่เสนอ

| ลำดับ | ทำอะไร | แรง |
|---|---|---|
| 1 | ยืนยันข้อ 3.2 (5 คำถาม) | — |
| 2 | migration + `compensation-fields.ts` + เปลี่ยนฟอร์มทั้ง 3 มา render จาก config | 1 วัน |
| 3 | เพิ่ม field ใหม่ทั้งหมด + label/remark ที่ขอ + number input ตัวเดียวใช้ร่วม | ครึ่งวัน |
| 4 | ต่อ preview / dashboard / benchmark ให้เห็น field ใหม่ | ครึ่งวัน |
| 5 | (ต่อยอด) Benefit Benchmark ในหน้า JR Salary Benchmark — ตอนนี้ทำได้แล้วเพราะมีข้อมูล | ครึ่งวัน |

---

---

## 7. แยกตาราง compensation ออกมาดีมั้ย

**สรุป: ยังไม่แยกตอนนี้ — แต่ทำ "รอยต่อ" ไว้ให้แยกทีหลังได้ถูก**

### ทำไมสุดท้ายควรแยก (ไม่ใช่เรื่องความสวยงาม)

เหตุผลเดียวที่มีน้ำหนักจริงคือ **compensation เป็นข้อมูลที่มีเวลากำกับ** — เงินเดือน ณ บริษัทเก่ากับบริษัทปัจจุบันเป็นคนละค่า
ตอนนี้เก็บบน `Candidate Profile` = มีได้ค่าเดียว **เขียนทับของเก่าทิ้งตลอด** ซึ่งแปลว่า:
- ถามไม่ได้ว่า "GM คนนี้ขึ้นเงินเดือนกี่ % ตอนย้ายงาน"
- benchmark ย้อนหลังไม่ได้ว่า "ปี 2024 ตำแหน่งนี้จ่ายเท่าไหร่" — มีแต่ค่าล่าสุด
- candidate ที่ข้อมูลเก่า 2 ปีแล้ว กับคนที่เพิ่งอัปเดตเมื่อวาน อยู่ในสถิติเดียวกันโดยไม่มีอะไรบอก

ปลายทางที่ถูกคือตารางแบบ `candidate_compensation (candidate_id, experience_id?, effective_date, ...)` หลายแถวต่อคน
สังเกตว่าระบบมีแนวคิดนี้อยู่แล้วครึ่งทาง — `employment_record` เก็บ `base_salary` ของ placement เป็นรายเรคอร์ดพร้อม `hire_date`

### ทำไมยังไม่ใช่ตอนนี้

| เหตุผล | รายละเอียด |
|---|---|
| **ราคาแพงกว่าที่ได้** | 13 ไฟล์อ่าน column พวกนี้ตรงๆ + ต้อง migrate ข้อมูล 8,900 คน + ทุก query ต้อง join |
| **ไม่ได้ช่วยสิ่งที่ขอ** | สิ่งที่ user ขอคือเพิ่ม 6 กล่อง + แก้ label — แยกตารางไม่ได้ทำให้เร็วขึ้นเลย |
| **ชนของที่ค้างอยู่** | JR Salary Benchmark / Stage Aging / search ที่เพิ่งทำยังรอ review อยู่ ถ้าแยกตารางตอนนี้ต้องแก้ทับงานที่ยังไม่ merge |
| **ยังไม่มีคนขอ history** | ความต้องการตอนนี้คือ "กรอกให้ครบขึ้น" ไม่ใช่ "ดูย้อนหลัง" |

### ทำอะไรแทน — วาง "รอยต่อ" ไว้

เพิ่ม column ใหม่บน `Candidate Profile` ไปก่อน (เร็ว เสี่ยงต่ำ) **แต่ห้ามให้ 13 ไฟล์อ่าน column ตรงๆ เพิ่มอีก** — ให้ผ่าน 2 ชั้นนี้แทน:

1. `src/lib/compensation-fields.ts` — schema ที่เดียว (ข้อ 4)
2. `src/lib/compensation.ts` — ชั้นอ่าน/เขียน: `getCompensation(candidateId)` / `saveCompensation(candidateId, values)`

วันที่ย้ายไปตารางใหม่จริง **แก้แค่ 2 ไฟล์นี้** ฟอร์ม/preview/dashboard/benchmark ไม่ต้องแตะเลย
ถ้าไม่วางชั้นนี้ไว้ การแยกตารางทีหลังจะกลายเป็นงานรื้อ 13 ไฟล์ซึ่งคงไม่มีใครกล้าทำ

### สัญญาณว่าถึงเวลาแยกแล้ว

แยกเมื่อ**ข้อใดข้อหนึ่ง**เกิดขึ้น — ไม่ใช่แยกเพราะรู้สึกว่ารก:
- มีคนถามว่า "ตอนอยู่ที่เก่าเขาได้เท่าไหร่" หรืออยากเทียบ % การขึ้นเงินเดือน
- อยากให้ salary benchmark กรองตามปี / ตัดข้อมูลที่เก่าเกิน 2 ปีออก
- ต้องการเก็บ compensation ต่อ experience (ไม่ใช่ต่อคน)
- ต้องจำกัดสิทธิ์ว่าใครเห็นเงินเดือนได้บ้าง (แยกตาราง = ทำ RLS ได้ตรงๆ)

---

## 8. "ไม่มีสวัสดิการ" vs "มีแต่ไม่รู้ตัวเลข" — จะทำยังไง

### ปัญหา

ตอนนี้ทั้งสองกรณีเก็บเป็นค่าว่างเหมือนกัน → สถิติเพี้ยนสองทาง: คนที่ "มี provident fund แต่ไม่รู้ %" ถูกนับเป็นไม่มี และคนที่ "ยังไม่ได้ถาม" ก็ถูกนับเป็นไม่มีเหมือนกัน

### ทางที่ไม่เอา

| ทางเลือก | ทำไมไม่เอา |
|---|---|
| ใส่ค่าพิเศษ เช่น `-1` แทน "มีแต่ไม่รู้" | พังเงียบๆ — ค่าเฉลี่ยกับ min จะเพี้ยนทันทีถ้ามีใครลืม filter |
| เพิ่ม boolean 1 ตัวต่อ 1 สวัสดิการ | 8 field ใหม่ → 16 column และจะโตเรื่อยๆ ทุกครั้งที่เพิ่มสวัสดิการ |
| ใช้ `0` แทน "มีแต่ไม่รู้" | ชนกับความหมาย "ไม่มี" ซึ่งก็คือ 0 จริงๆ |

### ที่เสนอ — 4 สถานะ ใช้ column เพิ่มแค่ **1 ตัว**

เพิ่ม `benefit_provided jsonb` บน `Candidate Profile` เก็บเฉพาะสถานะของสวัสดิการที่ user กดยืนยัน

| สถานะ | ช่องจำนวนเงิน | `benefit_provided` | UI |
|---|---|---|---|
| ยังไม่ได้ถาม / ไม่รู้ | `NULL` | ไม่มี key | ช่องว่าง ไม่ติ๊ก |
| **ยืนยันว่าไม่มี** | `0` | `{"provident_fund": false}` | ติ๊ก "ไม่มี" |
| **มี แต่ไม่รู้จำนวน** | `NULL` | `{"provident_fund": true}` | ติ๊ก "มี" ช่องเงินว่าง |
| มี และรู้จำนวน | `50000` | `{"provident_fund": true}` | ติ๊ก "มี" + กรอกเงิน |

ตัวอย่างค่าจริง: `{"provident_fund": true, "housing": false, "meal": true}`

**UI ต่อ 1 สวัสดิการ**: checkbox "มี" + ช่องกรอกเงิน (ช่องจะ disable ถ้ายังไม่ติ๊ก) — ติ๊กแล้วไม่กรอกเงินก็บันทึกได้ ซึ่งคือเคสที่ user ขอมาพอดี

**กฎการนับที่ต้องใช้ให้ตรงกันทุกที่** (เขียนเป็นฟังก์ชันเดียวใน `compensation.ts`):
- **ค่าเฉลี่ย / median ของจำนวนเงิน** → นับเฉพาะ `amount > 0` เท่านั้น
- **% ความครอบคลุม ("กี่ % ของ candidate ได้สวัสดิการนี้")** → นับ `provided === true` **หรือ** `amount > 0`
- **ตัวส่วน** → นับเฉพาะคนที่มีข้อมูล (`provided` มี key หรือ amount ไม่ null) ไม่ใช่ candidate ทั้งหมด — ไม่งั้น "ยังไม่ได้ถาม" จะถูกนับเป็น "ไม่มี" เหมือนเดิม

### ทำไมใช้ jsonb ไม่ใช่ boolean column

- เพิ่มสวัสดิการใหม่ครั้งหน้า **ไม่ต้อง migration** — แค่เพิ่ม key ใน `compensation-fields.ts`
- query ได้ปกติ: `where benefit_provided->>'provident_fund' = 'true'`
- ถ้าวันหนึ่งแยกตาราง compensation (ข้อ 7) ค่าพวกนี้ย้ายไปเป็นคอลัมน์จริงได้ง่าย เพราะตอนนั้นจะรู้แล้วว่าสวัสดิการอะไรบ้างที่ใช้จริง

### Migration เพิ่มจากข้อ 5

```sql
alter table public."Candidate Profile"
    add column if not exists benefit_provided jsonb;

comment on column public."Candidate Profile".benefit_provided is
    'Per-benefit tri-state: key present with true = provided (amount may be unknown), false = confirmed none, key absent = not asked. Amount columns hold the figure when known.';
```

→ **ไม่ต้องใช้ `provident_fund_provided boolean` ในข้อ 3.1 แล้ว** ตัวนี้ครอบคลุมทุกสวัสดิการในคราวเดียว

---

*Created: 2026-09-16 | Compensation & Benefits Fields v2 — table split + tri-state decisions*
