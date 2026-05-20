# Country / Location System — Context & Data Quality

> **COMPLETE** — ระบบสมบูรณ์แล้ว ไม่มีงานค้าง (verified 2026-05-20)
> อ่านไฟล์นี้ก่อนทุกครั้งที่แตะ country filter, "Based in" filter, หรือ candidate_profile_enhance.country
> ระวัง: country มี 2 แหล่งที่ต่างกันโดยสิ้นเชิง — อย่ารวมกัน, อย่าสับสน, อย่า recreate decision ที่บันทึกไว้แล้ว

---

## Overview — 2 แหล่งข้อมูล Country ที่ต่างกัน

| | candidate_experiences.country | candidate_profile_enhance.country |
|---|---|---|
| **หมายถึง** | ประเทศที่ทำงานในแต่ละ experience | ประเทศที่อยู่อาศัยปัจจุบัน |
| **แหล่งที่มา** | `work_location` field → normalization | `full_address` field (LinkedIn profile) |
| **ระดับ** | Experience-level (หลายแถวต่อ 1 candidate) | Profile-level (1 แถวต่อ 1 candidate) |
| **ใช้ใน filter** | Work Country filter | "Based in" filter (ยังไม่ได้สร้าง) |
| **ใช้ใน UI** | Candidate table, experience list | Candidate Profile Detail page |

**ห้ามรวมสองอย่างนี้เป็น filter เดียวกัน** — semantic ต่างกัน recruiter จะงงว่า candidate match จากอะไร

---

## candidate_experiences.country — Work Location

### Columns ที่เกี่ยวข้อง
```
work_location  text  — raw location ที่ candidate กรอกใน LinkedIn
country        text  — normalized country name (จาก normalization pipeline)
note           text  — บอกที่มาของ country value
```

### Note Values (สำคัญมาก)

| Note value | ความหมาย | ความน่าเชื่อถือ |
|---|---|---|
| `Location from profile input by candidate` | ได้จาก work_location → normalize ผ่าน unique_location_name | ✅ เชื่อถือได้ |
| `Location from HQ location` | work_location = NULL → AI เดาจากชื่อบริษัท | ❌ ไม่น่าเชื่อถือ |
| `Location from HQ location \| Location from profile input by candidate` | มีทั้งสองแหล่ง | ⚠️ ระวัง |
| `Need to check again` | ยังไม่ได้ตรวจ | ⚠️ ระวัง |
| NULL | ไม่มีข้อมูล | ❓ unknown |

### สถิติปัจจุบัน (total ~48,500 rows)

| Note | Rows | Candidates |
|---|---|---|
| Profile input | ~31,380 | ~8,000+ |
| HQ location | ~13,475 | 4,169 |
| HQ-only (ไม่มี profile input เลยสักงาน) | — | **1,005** |
| NULL | ~3,051 | 1,645 |

### ปัญหาของ HQ Location
- AI เดาจากชื่อบริษัท → ผิดบ่อย
- ตัวอย่าง: Accor, Google, JPMorgan, Tesco → assign "Thailand" ทั้งหมด แต่ candidate อยู่ฝรั่งเศส, อเมริกา, อังกฤษ
- เกิดจาก work_location = NULL ทำให้ไม่รู้ว่า candidate ทำงานสาขาไหน
- **ไม่ควรใช้ "experience ก่อนหน้า" แทน** เพราะ hospitality candidates เปลี่ยนประเทศบ่อยมาก (GM level ยิ่งเยอะ)

### การใช้ใน Search RPC
ปัจจุบัน: `search_candidate_ids` filter โดย `e.country = ANY(p_countries)` — รวม HQ location ด้วย

**งานที่ต้องทำ:** แก้ RPC ให้ filter country เฉพาะ note ILIKE '%profile input%' เท่านั้น
→ HQ rows ถูก treat as NULL ใน country filter แต่ candidate ยังอยู่ในระบบปกติ
→ อย่าลบ experience row ออก — แค่ไม่นำมาใช้ใน country filter

---

## candidate_profile_enhance.country — Current Location

### Columns ที่เกี่ยวข้อง
```
country       text  — ประเทศที่อยู่ปัจจุบัน (parse จาก full_address)
full_address  text  — ที่อยู่จาก LinkedIn profile เช่น "Bangkok, Bangkok City, Thailand"
```

### สถิติปัจจุบัน (total 8,921 candidates)

| สถานะ | จำนวน |
|---|---|
| มีทั้ง country และ full_address | 5,511 |
| มี full_address แต่ country ว่าง/NULL | **3,030** ← bug ที่แก้ได้ |
| มี country ไม่มี full_address | 122 |
| ไม่มีทั้งคู่ | 258 |

### Bug: 3,030 คนมี full_address แต่ country ว่าง
ตัวอย่าง:
```
full_address = "Bangkok, Bangkok City, Thailand"  → country = ""   ← ควรเป็น Thailand
full_address = "Phuket, Thailand"                 → country = ""   ← ควรเป็น Thailand
full_address = "Hong Kong SAR"                    → country = null ← ควรเป็น Hong Kong
```
**สาเหตุ:** parsing step ไม่ได้ extract country ออกจาก full_address
**วิธีแก้:** SQL update — parse last segment หลัง comma สุดท้าย (หรือ regex)
**ผลลัพธ์:** coverage ขึ้นจาก 5,633 เป็น ~8,663 candidates (~97% coverage)

**ใน 3,030 คนนั้น มี 1,438 คนที่ address มีคำว่า Thailand/Bangkok** — แก้ด้วย SQL ง่ายมาก

---

## แผนการพัฒนา

### ✅ ทำแล้ว
- normalization pipeline (fn_process_unified_cleansing) สำหรับ work_location → country
- note field บอก source ของ country value
- country ใช้ใน Work Country filter ใน search_candidate_ids RPC
- candidate_profile_enhance.country ใช้ใน Candidate Profile Detail page
- **Parse country จาก full_address** — SQL update แก้ 3,030 rows แล้ว เหลือ missing แค่ 5 rows (coverage 8,663/8,931 = ~97%)
- **Exclude HQ country ใน Work Country filter** — latest version ของ `search_candidate_ids` มี `note ILIKE '%profile input%'` filter แล้ว
- **"Based in" filter ใน ai-search-demo** — `p_based_in_countries` param อยู่ใน RPC แล้ว, FilterPanel + DemoFilterState เพิ่มแล้ว

### ✅ ไม่มีงานค้างแล้ว — ระบบ Country/Location สมบูรณ์

---

## Decision Log

| เรื่อง | ตัดสินใจ | เหตุผล |
|---|---|---|
| รวม work country + profile country เป็น filter เดียว | ❌ ไม่ทำ | Semantic ต่างกัน recruiter งง |
| ใช้ experience ก่อนหน้าแทน HQ location | ❌ ไม่ทำ | Hospitality candidates เปลี่ยนประเทศบ่อย ไม่น่าเชื่อถือ |
| ลบ experience ที่ note = HQ location | ❌ ไม่ทำ | 1,005 candidates จะหายไปจากระบบ |
| Treat HQ country as NULL ใน filter | ✅ ทำ | ข้อมูลยังอยู่ แต่ไม่ส่งผลต่อ country filter |
| Surface "data incomplete" flag ต่อ row | ❌ ไม่ทำ | Recruiter หมดความเชื่อใจในระบบ |

---

*Last updated: 2026-05-20 | Country/Location System v2 — all tasks complete*
