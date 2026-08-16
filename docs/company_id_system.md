# Company ID System — ความสัมพันธ์ของข้อมูล, Pipeline, และความยากในการจับคู่

> สรุปภาพรวมระบบ `company_id` สำหรับใช้สร้าง mapping/diagram และทำความเข้าใจก่อนแก้ไขส่วนที่เกี่ยวข้องกับ company resolution
> อ่านไฟล์นี้ก่อนทุกครั้งที่แตะ company matching, company_master/company_variation, หรือ company_id backfill

---

## 1. โครงสร้างข้อมูล (Tables & Relationships)

```
company_master  ← ศูนย์กลาง (Single Source of Truth)
├── company_id          (PK, bigint)
├── company_master      (ชื่อบริษัทหลัก/แม่แบบ)
├── industry            (เช่น "Hospitality", "Retail", "Wait AI Check")
├── group               (เช่น "Hospitality & Real Estate", "Retail / FMCG / F&B")
├── rating              (star rating ของบริษัทนี้ เช่น "5 Star")
├── hotel_chain_id      (FK → hotel_chain_master.brand_id)
└── company_logo

company_variation  ← ตาราง alias/ชื่อเรียกอื่นของบริษัท
├── variation_id        (PK)
├── company_id          (FK → company_master)
├── variation_name      (ชื่อ alias เช่น "Marriott Sukhumvit", "AIS PCL")
├── company_master_name
└── logic4_key          (key สำหรับ group ชื่อที่คล้ายกัน — ใช้ตอน autocomplete)

hotel_chain_master  ← ข้อมูล hotel chain/sub-brand (เฉพาะกลุ่ม Hospitality)
├── brand_id (PK)
├── brand_name
├── parent_id           (NULL = parent chain, มีค่า = sub-brand)
├── rating
└── company_id          (FK → company_master, บริษัทแม่ของ chain)

industry_group  ← ตาราง reference สำหรับ map industry → group (fallback)
├── industry
└── group

candidate_experiences  ← ประวัติการทำงานของ candidate
├── candidate_id
├── company             (ชื่อบริษัท raw text — ตามที่ candidate กรอก/LinkedIn)
├── company_id          (FK → company_master, NULLABLE)
├── company_industry    (snapshot ตอนบันทึก — อาจไม่ sync กับ master ปัจจุบัน)
└── company_group       (snapshot เช่นกัน)

org_chart_uploads  ← ไฟล์ org chart ที่ import เข้าระบบ
├── upload_id
├── company_name        (ชื่อ raw text)
└── company_id          (FK → company_master, NULLABLE)
```

**ความสัมพันธ์หลัก:** `company_master` คือ "ตัวตนที่แท้จริง" ของบริษัท ส่วน `company_variation` คือ "รายชื่อ alias ทั้งหมดที่ชี้กลับมาที่ company_id เดียวกัน" — แนวคิดคือไม่ว่า candidate จะกรอกชื่อบริษัทมาแบบไหน (ย่อ/เต็ม/branch/ภาษาไทย) ระบบควร resolve ไปที่ `company_id` เดียวกันได้ แล้วดึง metadata (industry/group/rating/chain/logo) จากจุดศูนย์กลางจุดเดียว

---

## 2. Pipeline: จากชื่อบริษัทดิบ → `company_id` (มี 4 เส้นทาง แยกกัน ไม่รวมศูนย์)

### เส้นทาง A — เพิ่ม Candidate Experience แบบ manual
**ไฟล์:** `src/app/actions/candidate.ts:35-65`
```
ชื่อบริษัท (raw text จากฟอร์ม)
   ↓
ILIKE match ตรงกับ company_master.company_master (case-insensitive, near-exact)
   ↓
  ┌─ เจอ → ใช้ company_id เดิม + inherit industry/group มาด้วย
  └─ ไม่เจอ → สร้าง company_master row ใหม่ทันที (industry = NULL, group = NULL)
```
⚠️ **ไม่แตะ `company_variation` เลย** — เช็คกับ `company_master` ตรงๆ เท่านั้น

### เส้นทาง B — Org Chart Import (ทั้ง PDF upload และ manual)
**ไฟล์:** `src/app/actions/org-chart-actions.ts:796-845`
```
ชื่อบริษัท
   ↓
ILIKE match กับ company_variation.variation_name ก่อน
   ↓
  ┌─ เจอ → ใช้ company_id จาก variation
  └─ ไม่เจอ → สร้างทั้งคู่: company_master (id ใหม่) + company_variation (alias ใหม่)
```
(นี่คือ logic เดียวกับที่ใช้ตอนแก้ "Uncategorized" 27 รายการของ Org Chart — ต่างกันตรงที่ทำ manual ผ่าน SQL ไม่ใช่ automation)

### เส้นทาง C — CSV Import (จำนวนมากที่สุด แต่ resolve น้อยที่สุด)
**ไฟล์:** `src/app/actions/csv-actions.ts`
```
เก็บชื่อบริษัทดิบเข้า candidate_experiences.company
company_id = NULL  ← ไม่มีการ resolve ใดๆ ทั้งสิ้น
```
กลายเป็น backlog ที่ต้องมาไล่ผูกย้อนหลัง (เหมือนงาน Uncategorized ที่เพิ่งทำกับ Org Chart)

### เส้นทาง D — Company Suggestion / Autocomplete (ตอนพิมพ์ในฟอร์ม)
**ไฟล์:** `src/app/actions/candidate-filters.ts:7-45` — ฟังก์ชัน `searchCompanies()`
```
query (ที่ user พิมพ์)
   ↓
ILIKE '%query%' บน company_variation.variation_name (fuzzy substring search)
   ↓
group ผลลัพธ์ด้วย logic4_key → เลือกชื่อที่ดีที่สุดมาแสดงเป็น suggestion
```
จุดนี้แค่ "ช่วยแนะนำชื่อ" — ไม่ resolve `company_id` ให้ ชื่อที่เลือกสุดท้ายจะวนกลับไปเข้าเส้นทาง A หรือ B อีกที

---

## 3. ใครใช้ `company_id` บ้าง (Consumers)

| Feature | การใช้งาน | ไฟล์อ้างอิง |
|---|---|---|
| **Org Chart Directory/Viewer** | join `company_master` เพื่อดึง group/industry → จัดกลุ่ม Directory + ดึง logo | `org-chart-actions.ts:104-142, 1167-1184` |
| **Hotel Chain System** | `company_master.hotel_chain_id` → resolve ไปที่ `hotel_chain_master` เพื่อหา chain name + star rating | `company-mgmt.ts`, `HotelChainMappingTab.tsx` |
| **Dashboard / KPI Reports** | โหลด `company_master` ทั้งตารางเป็น lookup map → enrich ชื่อ/industry/group/rating ใน report | `dashboard.ts:77-169` |
| **JR Candidates Enrichment** | หา industry/rating/group ของบริษัทปัจจุบัน/ล่าสุดของ candidate แต่ละคน | `jr-candidates.ts:175-288` |
| **AI Search (filters + RPC)** | `search_candidate_ids` RPC filter ตาม company/industry/group/hotel_chain/rating | `ai-search-demo.ts`, RPC `search_candidate_ids` |
| **Company Master Admin Panel** | CRUD จัดการ industry/group/rating/hotel_chain mapping ของแต่ละ `company_id` | `CompanyManagementClient.tsx` |
| **Candidate Table View** | แสดง chain badge + star rating badge จาก experience ล่าสุด | `table-view.tsx` (ผ่าน `get_company_chain_info` RPC) |

**หลักการ:** ทุก feature ข้างต้น "ไม่เก็บ industry/group/rating ซ้ำ" แต่ join ผ่าน `company_id` ไปหา `company_master` ทุกครั้งที่ต้องใช้ — นี่คือเหตุผลที่การแก้ `company_id` 1 จุด (เช่นการ backfill Uncategorized) ทำให้ทุก feature เห็นผลทันทีโดยไม่ต้องแก้โค้ด

---

## 4. ความยากของการจับคู่ (Matching Difficulty)

### 4.1 ไม่มี Naming Standard
Candidate กรอกชื่อบริษัทเองจาก resume/LinkedIn → รูปแบบไม่แน่นอน:
- ชื่อเต็ม vs ชื่อย่อ: "Advanced Info Service" vs "AIS" vs "AIS PCL"
- มี/ไม่มีคำต่อท้าย: "Marriott" vs "Marriott International" vs "Marriott Hotels & Resorts"
- มี branch/property ติดมา: "JW Marriott Bangkok", "Marriott Sukhumvit"
- ภาษาไทย/อังกฤษปนกัน, ตัวสะกด/วรรคตอนต่างกัน

### 4.2 Matching Algorithm ที่ใช้อยู่อ่อนเกินไป
- ใช้ **`ILIKE` (case-insensitive substring/exact)** เท่านั้น — **ไม่มี fuzzy matching, ไม่มี Levenshtein distance, ไม่มี trigram similarity**
- เหตุผลที่ตั้งใจไม่ทำ fuzzy: กลัว false-positive ที่อันตราย เช่น เคสที่เคยเจอ "AIS" ไป match กับ "Ma**ais**on" — ยิ่ง fuzzy มาก ยิ่งเสี่ยง map ผิดบริษัท ผิด rating ตาม

### 4.3 ปัญหา Parent ↔ Sub-brand ↔ Property (สำคัญที่สุดในกลุ่ม Hospitality)
```
Marriott International (parent — ไม่มี star rating)
   ├── JW Marriott (sub-brand — 5 ดาว)
   │     └── JW Marriott Bangkok (property จริงที่ candidate เคยทำงาน)
   └── Courtyard by Marriott (sub-brand — 3 ดาว)
```
ถ้า map "JW Marriott Bangkok" ไปที่ company_master = "Marriott International" (parent) → **จะไม่มี star rating ติดมาด้วย** เพราะ rating อยู่ที่ระดับ sub-brand เท่านั้น นี่คือเหตุผลที่ระบบ hotel chain เลือก map ที่ sub-brand เป็นหลัก (ดู `docs/hotel_chain_system.md`) — แต่ก็ทำให้ coverage ไม่ครบ (1,282/18,000 บริษัทเท่านั้นที่ map สำเร็จ)

### 4.4 Pipeline ไม่รวมศูนย์ → Logic ไม่สอดคล้องกัน
- เส้นทาง A เช็คกับ `company_master`, เส้นทาง B เช็คกับ `company_variation` → ชื่อเดียวกันอาจ resolve สำเร็จทางหนึ่งแต่ไม่สำเร็จอีกทาง → เกิด `company_master` ซ้ำซ้อน (duplicate) จากชื่อที่เป็นบริษัทเดียวกันจริงๆ
- เส้นทาง C (CSV) ข้าม resolution ไปเลย → กลายเป็น `company_id = NULL` สะสมเป็น backlog จำนวนมาก

### 4.5 Auto-create เป็น Default Behavior
ทุกครั้งที่หา match ไม่เจอ ระบบ **สร้าง `company_master` ใหม่ทันที** (ไม่ throw error, ไม่ queue ให้ review ก่อน) → เกิด record ใหม่ที่มี `industry = NULL`, `group = NULL` ทันที ซึ่งสะสมกลายเป็นกลุ่ม **"Wait AI Check"** (ปัจจุบันมีค้างอยู่ราว 1,087+ บริษัท ตามที่ระบุใน CLAUDE.md)

---

## 5. เมื่อหา `company_id` ไม่เจอ — เกิดอะไรขึ้น

| จุด resolve | พฤติกรรมเมื่อไม่เจอ match | ผลลัพธ์ที่ตามมา |
|---|---|---|
| Manual experience (เส้นทาง A) | Auto-create `company_master` ใหม่ (industry/group = NULL) | กลายเป็นสมาชิก "Wait AI Check" |
| Org Chart import (เส้นทาง B) | Auto-create ทั้ง `company_master` + `company_variation` | เช่นกัน + เพิ่ม alias ใหม่เข้าระบบ (ถ้าพิมพ์ผิดจะกลายเป็น alias ที่ผิดถาวร) |
| CSV Import (เส้นทาง C) | ไม่สร้างอะไร — `company_id = NULL` ค้างไว้ | candidate คนนั้นจะ "หายไป" จาก feature ที่ join ผ่าน company_id (filter ตาม industry/group/chain จะไม่เจอเขา) |

**ผลกระทบปลายทางที่เกิดร่วมกันทุกกรณี:**
- Org Chart Directory → ตกไปอยู่หมวด **"Uncategorized"**
- Hotel Chain filter → ไม่มี chain/star rating แสดง
- Dashboard/JR enrichment → fallback ไปแสดงชื่อ/industry/group แบบ raw text (snapshot เก่าที่บันทึกไว้ตอน insert ซึ่งอาจไม่ sync กับปัจจุบัน)
- AI Search filter ตาม industry/group/rating → พลาด candidate กลุ่มนี้ไปเลย

---

## 6. ถ้าระบบไม่มี `company_id` เลย (Hypothetical)

### 6.1 บริษัทเดียวกันจะแตกเป็นหลาย "ตัวตน" ตามตัวสะกด
ไม่มีจุดกลางที่บอกว่า "Marriott", "Marriott International", "Marriott Hotels Bangkok" คือบริษัท/เครือเดียวกัน → การนับ, filter, aggregation (เช่น "candidate กี่คนเคยทำงานที่ Marriott") จะนับขาด/นับซ้ำไม่ตรงความจริง

### 6.2 ต้อง Classify ซ้ำทุก row แทนที่จะทำครั้งเดียวแล้วใช้ร่วมกัน
ปัจจุบัน `industry`/`group`/`rating` เก็บที่ `company_master` ครั้งเดียว ทุก feature join ไปใช้ — ถ้าไม่มี `company_id`:
- ต้อง classify ใหม่ทุก row ของ `candidate_experiences` (string เดียวกันก็ต้อง map ซ้ำๆ)
- แก้ผิดจุดเดียวก็ต้องไล่แก้ string ที่คล้ายกันทุกที่ ไม่มีทาง "แก้จุดเดียว กระจายผลทุกฟีเจอร์ทันที" แบบที่ทำกับ Org Chart (อัปเดต 27 แถว → ทุกหน้าที่เกี่ยวข้องอัปเดตอัตโนมัติ)

### 6.3 Hotel Chain System จะสร้างไม่ได้เลย
โครงสร้าง `company_master.hotel_chain_id → hotel_chain_master.brand_id` ทั้งหมดต้องอาศัย `company_id` เป็นสะพาน — ถ้าไม่มี ไม่มีทางรู้ได้เลยว่า "Holiday Inn" ที่ candidate คนนี้เคยทำงานคือ chain ไหน, sub-brand อะไร, กี่ดาว ต้อง derive จาก raw string สดๆ ทุกครั้งซึ่งแม่นยำต่ำกว่ามาก

### 6.4 Org Chart Directory จัดกลุ่มไม่ได้แบบที่ทำอยู่
ฟีเจอร์ที่จัดกลุ่ม org chart ตาม group/industry ของ `company_master` จะทำไม่ได้เลย เพราะ `org_chart_uploads` มีแค่ raw text ต้องเดา/match string สดทุกครั้งที่โหลดหน้า ผลลัพธ์ไม่ stable และช้า

### 6.5 Filter/Search แม่นยำลดลงและช้าลง
AI Search/cascading filter ที่ filter ตาม industry/group/rating/company จะกลายเป็น text-matching (ILIKE) สดๆ ตอน query — ทั้งช้า (ไม่มี index ที่มีความหมายเชิง entity) และพลาดเคสสะกดต่างกันเล็กน้อย

---

## 7. สรุปภาพรวมเชิงสถาปัตยกรรม

**แนวคิดหลัก:** `company_id` ทำหน้าที่เป็น **"normalization layer"** — แปลง string ที่หลากหลาย (ชื่อบริษัทดิบจาก candidate/org chart) ให้กลายเป็น entity ID เดียวที่ชัดเจน แล้วผูก metadata ทั้งหมด (industry, group, rating, hotel chain, logo) ไว้ที่จุดศูนย์กลางจุดเดียวคือ `company_master`

**จุดอ่อนของระบบปัจจุบัน:**
1. มี 4 เส้นทาง resolve ที่ไม่ sync logic กัน (A, B ต่างกัน, C ไม่ resolve เลย, D เป็นแค่ suggestion)
2. ใช้ matching แบบง่าย (ILIKE) ไม่มี fuzzy/similarity → พลาดมาก
3. Auto-create เป็นค่า default → สร้างขยะ (`Wait AI Check`, `Uncategorized`) สะสม
4. ไม่มี queue/review step ก่อนสร้าง record ใหม่ → ผิดแล้วแก้ยาก ต้องมาตามแก้ทีหลัง

**ทำไมระบบถึงออกแบบมาแบบนี้ (lenient):** เพื่อไม่ให้ candidate ตกหล่นจากระบบ (ยอมสร้าง record ใหม่ที่ข้อมูลไม่ครบ ดีกว่าทิ้งไว้เป็น `NULL` แล้ว candidate หายไปจากทุก feature) — แลกมาด้วยงาน cleanup/classification ที่ต้องทำตามหลังต่อเนื่อง (manual + n8n AI classification)

---

*Last updated: 2026-06-08 | Company ID System v1 — research summary*
