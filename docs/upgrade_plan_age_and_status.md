# Upgrade Plan: Age System + Candidate Status (Remark)

> **สถานะ:** รอดำเนินการ (ทำคืนนี้)
> **เหตุผล:** age คำนวณไม่ตรงกันระหว่าง DB กับ UI, candidate_status รองรับแค่ค่าเดียว

---

## Part 1 — ระบบ Age

### ปัญหาที่พบ

| จุด | แสดงผล | แหล่งข้อมูล |
|---|---|---|
| Candidate Profile page | 60 | `Candidate Profile.age` (DB column) |
| JR manage list | 60 | `Candidate Profile.age` (DB column) |
| Placement page | 59 | `getEffectiveAge(date_of_birth)` — คำนวณ real-time |
| Edit Profile form | 60 | `Candidate Profile.age` (DB column) |

**สาเหตุ:** `age` เป็น text column ที่ถูก import ครั้งเดียวด้วยวิธีนับอายุแบบเอเชีย (นับปีเกิดเป็น 1) ทำให้เกินจริง 1 ปี

**สถิติ:**
- มี `date_of_birth`: 63 คน (2 format: `M/D/YYYY` และ `YYYY-MM-DD`)
- มี `age` (ตัวเลขล้วน): 5,898 คน
- ไม่มีทั้งคู่: 3,727 คน

---

### Step 1.1 — DB: Recalculate age จาก date_of_birth (63 rows)

```sql
UPDATE "Candidate Profile"
SET age = EXTRACT(YEAR FROM AGE(
    NOW(),
    CASE
        WHEN date_of_birth ~ '^\d{4}-\d{2}-\d{2}$'
            THEN TO_DATE(date_of_birth, 'YYYY-MM-DD')
        WHEN date_of_birth ~ '^\d{1,2}/\d{1,2}/\d{4}$'
            THEN TO_DATE(date_of_birth, 'MM/DD/YYYY')
    END
))::text
WHERE date_of_birth IS NOT NULL
  AND date_of_birth != ''
  AND date_of_birth ~ '^\d';
```

ทำก่อน Step 1.2 เพราะหลัง ALTER type แล้วต้อง cast ใหม่

---

### Step 1.2 — DB: เปลี่ยน `age` column จาก `text` → `integer`

```sql
ALTER TABLE "Candidate Profile"
ALTER COLUMN age TYPE integer
USING CASE WHEN age ~ '^\d+$' THEN age::integer ELSE NULL END;
```

ทุก row ที่มีค่าล้วนเป็นตัวเลขอยู่แล้ว (5,898/5,898) — safe

---

### Step 1.3 — DB/RPC: แก้ age filter ทุก RPC

เปลี่ยนทุกจุดที่ใช้:
```sql
-- เดิม (ต้อง regex check ก่อน)
AND (cp.age ~ '^\d+$' AND cp.age::int >= p_age_min)
AND (p_age_include_unknown AND (cp.age IS NULL OR cp.age = '' OR cp.age !~ '^\d+$'))
```
เป็น:
```sql
-- ใหม่ (integer เปรียบตรงได้เลย)
AND (cp.age >= p_age_min)
AND (p_age_include_unknown AND cp.age IS NULL)
```

RPC ที่ต้องแก้:
- `search_candidate_ids` (มีหลาย overload — แก้ทุก version ล่าสุด)
- `get_chain_counts_filtered`
- `get_cascading_options` (ถ้ามี age filter)

---

### Step 1.4 — Backend: แก้ save age เป็น integer

**`src/app/api/candidates/[id]/route.ts`**
```typescript
// เดิม
age: body.age
// ใหม่
age: body.age ? parseInt(body.age) || null : null
```

**`src/app/api/candidates/create/route.ts`**
- ตรวจว่า finalAge ถูก save เป็น integer (ปัจจุบัน calculate แล้ว store เป็น string)

**`src/app/api/candidates/search/route.ts` (line 83-84)**
```typescript
// เดิม — filter ใช้ string comparison
.gte('age', filters.ageMin).lte('age', filters.ageMax)
// ใหม่ — integer comparison ทำงานถูกต้องอยู่แล้วถ้า column เป็น int
// ไม่ต้องแก้ logic แต่ต้องแน่ใจ type ตรงกัน
```

---

### Step 1.5 — Frontend: TypeScript types

**`src/app/candidates/list/table-view.tsx` (line 42)**
**`src/app/candidates/list/page.tsx` (line 65)**
**`src/components/reports/AgingCandidateTable.tsx` (line 37)**
```typescript
// เปลี่ยนจาก
age: number
// เป็น (รองรับ NULL ด้วย)
age: number | null
```

---

### Step 1.6 — Frontend: แก้ edit form save age

**`src/components/candidate-edit-form.tsx` (line 121, 321)**
```typescript
// load จาก DB (line 121)
age: data.age?.toString() || ""   // ยังคงเป็น string ใน form state — ไม่ต้องแก้

// save กลับ DB (line 321)
// เดิม
age: formData.age,
// ใหม่
age: formData.age ? parseInt(formData.age) || null : null,
```

**`src/app/candidates/new/page.tsx` (line ~382)**
- แก้เหมือนกัน: parse to int ก่อน submit

---

### Step 1.7 — Frontend: Display จุดอื่นๆ

ไฟล์เหล่านี้อ่าน `candidate.age` โดยตรง — ไม่ต้องแก้ logic เพราะ JS render integer กับ string เหมือนกัน แต่ต้องแน่ใจว่า handle `null` ได้:

| ไฟล์ | บรรทัด | หมายเหตุ |
|---|---|---|
| `src/app/candidates/[id]/page.tsx` | 145–149 | `candidate.age` — เพิ่ม null check |
| `src/app/candidates/list/page.tsx` | 1011 | `candidate.age` — เพิ่ม null check |
| `src/app/candidates/list/table-view.tsx` | 182 | `candidate.age` — เพิ่ม null check |
| `src/components/jr-candidate-sheet.tsx` | 286 | `candidate?.age` — OK แล้ว |
| `src/components/reports/AgingCandidateTable.tsx` | 105 | `candidate.age` — เพิ่ม null check |
| `src/app/dashboard/page.tsx` | 53, 74 | fetch + filter age range — ตรวจ type |
| `src/app/actions/jr-candidates.ts` | 281 | map `candidate_age: profile?.age` |

---

## Part 2 — Candidate Status / Remark

### ปัญหาที่พบ

- `candidate_status` เป็น `text` — รองรับแค่ค่าเดียว
- ต้องการ multi-value (เช่น Blacklist + Over-aged พร้อมกัน)
- ต้องการ auto-set "Over-aged" เมื่อ age ≥ 57
- **ชื่อที่ถูกต้องใน DB:** `"Over-aged"` (hyphen, lowercase a)
- ตัวเลือกทั้งหมดจาก `candidate_status_master`: Blacklist, Over-aged, Internal Candidate, Don't touch, Ex-Central
- **`StatusSelect` component ปัจจุบัน:** single-select (props: `value?: string`, `onChange: (value: string)`)

---

### Step 2.1 — DB: เปลี่ยน column type `text` → `text[]`

```sql
ALTER TABLE "Candidate Profile"
ALTER COLUMN candidate_status TYPE text[]
USING CASE
    WHEN candidate_status IS NULL OR candidate_status = '' THEN NULL
    ELSE ARRAY[candidate_status]
END;
```

migrate ข้อมูลเดิม 408 rows ให้เป็น array อัตโนมัติ

---

### Step 2.2 — Backend: Auto-set "Over-aged" เมื่อ save age ≥ 57

ใส่ใน `src/app/api/candidates/[id]/route.ts` หลัง parse age:

```typescript
const age = body.age ? parseInt(body.age) || null : null;

// Auto-add Over-aged
if (age !== null && age >= 57) {
    const currentStatuses: string[] = existingCandidate.candidate_status ?? [];
    if (!currentStatuses.includes('Over-aged')) {
        updates.candidate_status = [...currentStatuses, 'Over-aged'];
    }
}
// ไม่ลบออกถ้า age < 57 — ให้ user จัดการเอง
```

**กรณีสร้างใหม่:** ทำเหมือนกันใน `src/app/api/candidates/create/route.ts`

---

### Step 2.3 — TypeScript types: ทุกไฟล์ที่ define candidate_status

เปลี่ยนทุกที่จาก `string` → `string[] | null`:

| ไฟล์ | บรรทัด |
|---|---|
| `src/app/candidates/list/table-view.tsx` | 44 |
| `src/app/candidates/list/page.tsx` | 67 |
| `src/components/candidate-list.tsx` | 39 |
| `src/types/requisition.ts` | ตรวจสอบ |
| `src/app/actions/jr-candidates.ts` | 283 (map type) |

---

### Step 2.4 — Frontend: แก้ Blacklist checks ทุกจุด

เปลี่ยนจาก `=== 'Blacklist'` → `.includes('Blacklist')`:

| ไฟล์ | บรรทัด | context |
|---|---|---|
| `src/app/actions/jr-candidates.ts` | 520–531 | **single add validation** — block add to JR |
| `src/app/actions/jr-candidates.ts` | 611–631 | **bulk add validation** — filter out blacklisted |
| `src/components/candidate-edit-form.tsx` | 607–619 | แสดง `blacklist_note` field เมื่อ status = Blacklist |
| `src/components/candidate-list.tsx` | 1043–1047 | badge color logic |
| `src/components/jr-candidate-sheet.tsx` | 121 | badge color logic |
| `src/app/candidates/list/table-view.tsx` | 189–198 | badge color logic |
| `src/app/candidates/[id]/page.tsx` | 120–124 | badge display |

---

### Step 2.5 — Frontend: Display — แสดงหลาย badge

แก้ทุกจุดที่แสดง `candidate_status` เป็น badge เดียว:

```tsx
// เดิม — badge เดียว
{c.candidate_status && (
    <Badge className={getStatusColor(c.candidate_status)}>
        {c.candidate_status}
    </Badge>
)}

// ใหม่ — loop array
{c.candidate_status?.map(s => (
    <Badge key={s} className={getStatusColor(s)}>{s}</Badge>
))}
```

ไฟล์ที่ต้องแก้:
- `src/components/candidate-list.tsx` (Remark column ใน JR manage)
- `src/components/jr-candidate-sheet.tsx`
- `src/app/candidates/list/table-view.tsx`
- `src/app/candidates/[id]/page.tsx`

---

### Step 2.6 — Frontend: แก้ filter query

**`src/app/api/candidates/search/route.ts` (line 80)**
```typescript
// เดิม — .in() ใช้กับ text column
.in('candidate_status', filters.status)

// ใหม่ — .contains() สำหรับ array column
// หา candidates ที่มี status ใดๆ ใน filters.status
// (OR logic — มี status อย่างน้อย 1 ที่ match)
.overlaps('candidate_status', filters.status)
```

---

### Step 2.7 — Frontend: อัปเกรด StatusSelect → Multi-select

**`src/components/ui/status-select.tsx`** — เขียนใหม่ทั้งหมด

Props ใหม่:
```typescript
interface StatusSelectProps {
    value?: string[] | null;          // เปลี่ยนจาก string → string[]
    onChange: (value: string[]) => void; // เปลี่ยนจาก string → string[]
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}
```

UX ใหม่:
- Popover เปิดค้างไว้ — คลิกได้หลายรายการพร้อมกัน
- แต่ละ option มี checkbox
- Selected items แสดงเป็น badge row ด้านบน input
- ยัง support "Create new status" เหมือนเดิม
- ยัง support color indicator เหมือนเดิม
- "None (Clear all)" ล้างทุกค่า

**`src/components/candidate-edit-form.tsx`** — update รับ/ส่ง array:
```typescript
// load (line 111)
candidate_status: data.candidate_status ?? [],

// save (line 312)
candidate_status: formData.candidate_status,  // ส่ง array ตรงๆ
```

---

### Step 2.8 — Frontend: blacklist_note conditional

**`src/components/candidate-edit-form.tsx` (line 607–619)**
```typescript
// เดิม
{formData.candidate_status === "Blacklist" && (...)}

// ใหม่
{formData.candidate_status?.includes("Blacklist") && (...)}
```

---

## Test Cases

### TC-1: Age คำนวณถูกต้องหลังแก้

| Candidate | DOB | อายุที่ถูก (สากล) | อายุ DB ก่อนแก้ |
|---|---|---|---|
| **C00077** Siriwan Wangthamrong | 5/6/1967 (6 พ.ค.) | **59** | 60 |

ตรวจใน: **JR000014**, **JR000159**
- JR manage SEX/AGE column → "Female, 59"
- Edit Profile age field → 59
- Placement page → "59 yrs" (ถูกอยู่แล้ว — ต้องไม่เปลี่ยน)

---

### TC-2: Auto Over-aged เมื่อ age ≥ 57

| Candidate | Age (หลังแก้) | Status ก่อน | Status หลัง |
|---|---|---|---|
| **C00077** | 59 | `null` | `["Over-aged"]` |
| **C00048** | 58 | `"Over-aged"` | `["Over-aged"]` (ไม่ duplicate) |
| **C00087** | 59 | `"Over-aged"` | `["Over-aged"]` (ไม่ duplicate) |

ตรวจใน: **JR000014**, **JR000016**, **JR000196**
- Remark column แสดง badge "Over-aged"
- เปิด JR000014 → candidates อายุ ≥ 57 ทุกคนต้องมี Over-aged badge

---

### TC-3: 2 Status พร้อมกัน (Blacklist + Over-aged)

กรณีนี้ต้องสร้าง test เอง เพราะ column เดิมเป็น text จึงไม่มีข้อมูลแบบนี้

**วิธีทดสอบ:** แก้ C00251 (Blacklist, age 50) ผ่าน Edit Profile → เปลี่ยน age เป็น 57+ แล้วบันทึก

| Candidate | Jr_id | Status คาดหวัง |
|---|---|---|
| **C00251** (หลัง set age ≥ 57) | JR000111, JR000133, JR000156 | `["Blacklist", "Over-aged"]` |

ตรวจใน: **JR000156**
- Remark column → 2 badge: 🔴 Blacklist + 🟠 Over-aged
- Blacklist validation ตอน Add to JR ยัง block อยู่ (ต้อง check `includes` ไม่ใช่ `===`)

---

### TC-4: candidate ที่ age < 57 — ไม่ควรได้ Over-aged

| Candidate | Age | Status ปัจจุบัน | Status คาดหวัง |
|---|---|---|---|
| C00251 | 50 | Blacklist | `["Blacklist"]` |
| C05163 | 44 | Blacklist | `["Blacklist"]` |
| C00253 | 50 | Blacklist | `["Blacklist"]` |

ตรวจใน: **JR000085**, **JR000111**, **JR000140**

---

### TC-5: ลด age กลับต่ำกว่า 57 — ไม่ลบ Over-aged อัตโนมัติ

ระบบ **ไม่ลบ** Over-aged ออกเองเมื่อแก้ age กลับ — user ต้องลบเอง

วิธีทดสอบ: แก้ C00048 (age 58, Over-aged) → เปลี่ยน age เป็น 40 → บันทึก
- ผลลัพธ์ที่ถูกต้อง: status ยังคงเป็น `["Over-aged"]` อยู่

---

### TC-6: Multi-select StatusSelect — เลือก 2 status

วิธีทดสอบ: เปิด Edit Profile ของ candidate ใดก็ได้ → เลือก "Internal Candidate" และ "Ex-Central" พร้อมกัน → บันทึก
- ผลลัพธ์ที่ถูกต้อง: DB เก็บ `["Internal Candidate", "Ex-Central"]`
- Remark column แสดง 2 badge

---

### TC-7: Blacklist_note field แสดงเมื่อ multi-status มี Blacklist

วิธีทดสอบ: Edit Profile → เลือก "Blacklist" + "Over-aged" พร้อมกัน
- ผลลัพธ์ที่ถูกต้อง: `blacklist_note` textarea ต้องปรากฏ
- ถ้าเลือกแค่ "Over-aged" → textarea ไม่ปรากฏ

---

## สรุป files ที่ต้องแก้ทั้งหมด

### DB Migrations (ทำก่อน)

| Migration | รายละเอียด |
|---|---|
| `recalculate_age_from_dob` | UPDATE 63 rows จาก date_of_birth |
| `alter_age_column_to_integer` | text → integer |
| `alter_candidate_status_to_array` | text → text[] + migrate data |

### Backend

| ไฟล์ | เหตุผล |
|---|---|
| `src/app/api/candidates/[id]/route.ts` | parse age as int + auto Over-aged logic |
| `src/app/api/candidates/create/route.ts` | parse age as int + auto Over-aged logic |
| `src/app/api/candidates/search/route.ts` | เปลี่ยน `.in()` → `.overlaps()` สำหรับ status |
| RPC `search_candidate_ids` | ลบ regex check บน age |
| RPC `get_chain_counts_filtered` | ลบ regex check บน age |

### Frontend — Components

| ไฟล์ | เหตุผล |
|---|---|
| `src/components/ui/status-select.tsx` | **เขียนใหม่** single → multi-select |
| `src/components/candidate-edit-form.tsx` | age save as int, status as array, includes check, blacklist_note |
| `src/components/candidate-list.tsx` | multi badge display + includes check |
| `src/components/jr-candidate-sheet.tsx` | multi badge display + includes check |

### Frontend — Pages / Actions

| ไฟล์ | เหตุผล |
|---|---|
| `src/app/candidates/[id]/page.tsx` | multi badge + null check on age |
| `src/app/candidates/list/page.tsx` | type update + null check on age |
| `src/app/candidates/list/table-view.tsx` | type update + multi badge + null check |
| `src/app/candidates/new/page.tsx` | age save as int |
| `src/app/actions/jr-candidates.ts` | Blacklist check → includes + type update |
| `src/app/actions/candidate-check.ts` | Blacklist check → includes |
| `src/app/dashboard/page.tsx` | type check สำหรับ age range filter |
| `src/components/reports/AgingCandidateTable.tsx` | null check on age |

---

*Last updated: 2026-05-20 | Plan v2 — full audit*
