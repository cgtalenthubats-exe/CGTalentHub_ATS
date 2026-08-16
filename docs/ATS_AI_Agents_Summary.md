# ATS System — AI Agents & Chatbot+UI Report Concept

> **สรุปการออกแบบระบบ AI Agent ตั้งแต่ต้นจนจบ**  
> Last Updated: April 2026  
> Stack: Supabase · N8N · Claude API · Gemini API · Antigravity IDE

---

## สารบัญ

1. [ภาพรวมระบบทั้งหมด](#1-ภาพรวมระบบทั้งหมด)
2. [Chatbot Phase — ก่อนเริ่ม Process](#2-chatbot-phase--ก่อนเริ่ม-process)
3. [AI Agent 1 — Preliminary AI](#3-ai-agent-1--preliminary-ai)
4. [AI Agent 2 — Screening AI](#4-ai-agent-2--screening-ai)
5. [AI Agent 3 — Ranking AI](#5-ai-agent-3--ranking-ai)
6. [UI Report — การแสดงผล](#6-ui-report--การแสดงผล)
7. [Work ID — ตัวเชื่อมทุกอย่าง](#7-work-id--ตัวเชื่อมทุกอย่าง)
8. [N8N Workflow Orchestration](#8-n8n-workflow-orchestration)
9. [Model Selection & Cost](#9-model-selection--cost)

---

## 1. ภาพรวมระบบทั้งหมด

### Two System Concepts ที่รวมกัน

ระบบนี้เกิดจากการรวม 2 concept เข้าด้วยกัน:

**System A (Chatbot)** — ข้อดีคือ back-and-forth ได้ แต่ข้อเสียคือแสดงผลได้แค่ 4-5 คนในแชท

**System B (Batch/Table)** — ข้อดีคือแสดงผลเป็นตาราง UI ชัดเจน แต่ข้อเสียคือ user ค้นหาได้แค่ครั้งเดียว ถ้า query ไม่ดี ผลก็ไม่ดี

**Solution — Hybrid System:** ใช้ทั้งสองอย่างรวมกัน

```
Phase 1: Chatbot        → clarify query ก่อน
Phase 2: Batch Process  → AI ทำงานอัตโนมัติ
Phase 3: UI Report      → แสดงผลเป็นตาราง
Phase 4: Chat again     → user refine ได้หลังเห็นผล
```

### Flow ทั้งหมด

```
User พิมพ์ query ในแชท
        ↓
Chatbot (Preliminary AI) รับและ clarify
        ↓
สร้าง Work ID (Job Order)
        ↓
Stage 1: SQL Filter → ได้ candidate list (487 คน)
        ↓
แสดงผล 487 คนทันที (UI บอก "AI กำลังประเมินอยู่...")
        ↓
Stage 2: AI Screening (background) → เหลือ 100-200 คน
        ↓
Stage 3: AI Ranking (background) → Top 20-50 คน
        ↓
UI อัปเดต → แสดง Top 20 พร้อม score ที่ด้านบน
        ↓
User ดูผล → chat ต่อเพื่อ refine ได้ (optional)
```

---

## 2. Chatbot Phase — ก่อนเริ่ม Process

### หน้าที่

รับ query จาก user แล้วตรวจสอบว่ามีข้อมูลเพียงพอสำหรับการ filter หรือไม่

### ปัญหาที่ต้องแก้

ถ้า user พิมพ์แค่ "Find CEO of hotel in Thailand" โดยไม่มีรายละเอียดเพิ่ม ระบบจะได้ candidate มากเกินไป (400-500+ คน) และไม่มีเกณฑ์พอสำหรับ screening

### Logic การตัดสินใจ

```
รับ query จาก user
        ↓
AI วิเคราะห์ว่า query มีข้อมูลเพียงพอมั้ย?

ถ้าพอ (มี role + industry + location + criteria):
  → สร้าง Work ID และเริ่ม Stage 1 ทันที

ถ้าไม่พอ (มีแค่ role + location):
  → AI ถามกลับ เช่น
     "พบว่าข้อมูลยังไม่ครบ เพื่อให้ได้ผลลัพธ์ที่ดีขึ้น
      ช่วยตอบคำถามต่อไปนี้:
      1. ต้องการประสบการณ์ขั้นต่ำกี่ปี?
      2. มี brand preference มั้ย? (Marriott, Hilton, etc.)
      3. ขนาด property ที่ต้องการ? (200+ rooms?)"
        ↓
User ตอบ → AI รวบรวม criteria
        ↓
User พิมพ์ว่า "OK" หรือ "Search now"
        ↓
สร้าง Work ID และเริ่ม Stage 1
```

### ข้อมูลที่ AI ควรถาม (ถ้าขาด)

```
Must-have criteria:
  - ตำแหน่งงาน (role/title)
  - Industry หรือ company_group
  - ประเทศหรือภูมิภาค

Nice-to-have criteria (ถามถ้าไม่มี):
  - ประสบการณ์ขั้นต่ำ (กี่ปี)
  - Brand preference
  - ขนาด property หรือองค์กร
  - สัญชาติ หรือ nationality requirement
  - ภาษาที่ต้องการ
  - อะไรก็ตามที่เป็น semantic (เช่น "branch expansion experience")
```

### Chat History Storage

ระบบเก็บ history การสนทนาใน SQL เพื่อให้ AI จำ context ของ conversation ได้ แม้ user จะพิมพ์หลายข้อความ

---

## 3. AI Agent 1 — Preliminary AI

### หน้าที่หลัก

แปลง natural language query จาก user ให้กลายเป็น SQL query และ semantic filters

### Input

```
User query (refined จาก chatbot phase):
"Find CEO of 4-5 star hotel in Thailand 
 with Marriott or Hilton experience
 and experience in branch expansion"
```

### กระบวนการทำงาน

**ขั้นที่ 1 — Intent Extraction**
แยก query ออกเป็นส่วนๆ:
```
Role:      CEO
Industry:  Hospitality / Hotel
Tier:      4-5 star (Marriott, Hilton = proxy)
Location:  Thailand
Semantic:  branch expansion experience
```

**ขั้นที่ 2 — Schema Mapping**
Map intent ไปยัง database fields:
```
Role         → position_keyword + position_level
Industry     → company_group + company_industry
Location     → candidate_experiences.country
               + candidate_profile_enhance.country
Nationality  → candidate_profile_enhance.nationality
Semantic     → ส่งต่อ Stage 2 (SQL หาไม่ได้)
```

**ขั้นที่ 3 — SQL Generation**
สร้าง SQL query ที่กว้างพอ (ยอม false positive):
```sql
SELECT DISTINCT
  c.candidate_id, c.name, c.linkedin,
  e.position, e.position_keyword, e.position_level,
  e.company, e.company_industry, e.company_group,
  e.country AS work_country,
  e.start_date, e.end_date, e.is_current_job,
  p.nationality, p.country AS current_country,
  p.languages, p.skills_list
FROM candidate_profile c
JOIN candidate_experiences e ON c.candidate_id = e.candidate_id
JOIN candidate_profile_enhance p ON c.candidate_id = p.candidate_id
WHERE
  e.position_level = 'C-Level'
  AND (
    e.position_keyword ILIKE '%CEO%'
    OR e.position ILIKE ANY(ARRAY['%CEO%','%chief executive%','%managing director%'])
  )
  AND e.company_group = 'Hospitality/Real Estate'
  AND (
    e.country ILIKE '%thailand%'
    OR p.country ILIKE '%thailand%'
  )
ORDER BY e.end_date DESC NULLS FIRST;
```

**ขั้นที่ 4 — Result Check**
ตรวจสอบจำนวน result:
```
ได้ < 50 คน   → ขยาย synonym / ลด constraint / แจ้ง user
ได้ 50-1000   → ส่งต่อ Stage 2 ✅
ได้ > 1000 คน → เพิ่ม is_current_job = 'Current' / แจ้ง user
```

### Output (JSON ส่งต่อระบบ)

```json
{
  "work_id": "JO_20260428_001",
  "search_intent": {
    "role": "CEO",
    "industry": "Hospitality",
    "location": "Thailand"
  },
  "sql_filters": {
    "position_level": ["C-Level"],
    "position_keyword": ["CEO", "Chief Executive Officer"],
    "company_group": ["Hospitality/Real Estate"],
    "work_country": ["Thailand"]
  },
  "semantic_filters": [
    "branch expansion experience",
    "Marriott or Hilton brand experience"
  ],
  "candidate_ids": ["C00123", "C00456", "..."],
  "result_count": 487,
  "confidence": "high"
}
```

### Model ที่แนะนำ

**Gemini 2.5 Flash-Lite** ($0.10/$0.40 per 1M tokens)
- งานนี้ไม่ซับซ้อน แค่แปลง query เป็น SQL
- มี vocabulary/dictionary ของ schema ใน system prompt อยู่แล้ว
- ไม่ต้องใช้ model ฉลาดมาก ประหยัดได้มาก

---

## 4. AI Agent 2 — Screening AI

### หน้าที่หลัก

กรอง candidate list จาก Stage 1 โดยเทียบกับ criteria ให้เหลือเฉพาะคนที่ผ่าน minimum requirements

### หลักการสำคัญ

Stage 2 ไม่ใช่การ rank หรือให้คะแนน แต่เป็นแค่ **PASS / FAIL gate**

```
เป้าหมาย:
Input:  487 candidates (จาก Stage 1)
Output: 100-200 candidates (เฉพาะ PASS)

ตัดคนที่ชัดเจนว่าไม่ตรง → เหลือคนที่ "อาจจะตรง"
```

### Batch Processing Flow

```
Work ID มี 487 candidate IDs
        ↓
N8N แบ่ง batch ละ 25 คน (= 20 batches)
        ↓
สำหรับแต่ละ batch:
  1. เรียก MCP ดึงข้อมูล 25 candidate IDs เหล่านั้น
  2. ส่งข้อมูลให้ AI พร้อม criteria
  3. AI ตอบ pass/fail + เหตุผล
  4. บันทึกผลลัพธ์กลับเข้า Work ID
  5. ไป batch ถัดไป
        ↓
รวมผล → เหลือ 100-200 คนที่ PASS
```

### ข้อมูลที่ดึงต่อ Candidate (ต้องสั้น ~150 tokens)

```
ดึงเฉพาะ essential fields:
  - candidate_id
  - position
  - position_level
  - position_keyword
  - company
  - company_industry
  - country (work)
  - skills_list
  - nationality
  - languages

ไม่ดึง (ยาวเกิน):
  - experience_summary
  - about_summary
  - education_summary
```

### Prompt Template

```
System: You are an expert HR screener. Evaluate each candidate.

Search Criteria:
{criteria_from_user_query}

Must-have:
{must_have_list}

Disqualifiers (fail immediately if any):
{disqualifier_list}

For each candidate, return JSON array ONLY:
[{"id": "C00123", "pass": true, "reason": "15yr C-Level hotel exp"}]

Keep reason under 15 words. No explanation outside JSON.

Candidates:
{batch_of_25_candidates}
```

### เกณฑ์ Pass/Fail

```
PASS ถ้า:
  ✅ มี position_level ตรงกับที่ต้องการ
  ✅ มี industry ที่เกี่ยวข้อง
  ✅ อยู่ในประเทศที่ต้องการ (หรือเคยทำงานที่นั่น)
  ✅ มี skills พื้นฐานที่ต้องการ

FAIL ถ้า:
  ❌ ระดับตำแหน่งต่ำเกินไป
  ❌ ไม่เคยทำงานใน industry ที่ต้องการเลย
  ❌ ไม่มีภาษาที่กำหนด (ถ้ามี requirement)
  ❌ ข้อมูลน้อยเกินไปจน assess ไม่ได้
```

### กรณีที่ User ไม่ให้ criteria มากพอ

ถ้า user พิมพ์แค่ "Find CEO of hotel in Thailand" โดยไม่มีรายละเอียดเพิ่ม:
- Stage 2 จะ PASS เกือบทุกคนที่ SQL คืนมา
- ผลที่ได้คือ 400+ คนผ่าน Stage 2
- Stage 3 จะต้องทำงานหนักขึ้น
- ดังนั้น Chatbot Phase ต้องถามให้ครบก่อน

### Model ที่แนะนำ

**Gemini 3 Flash** ($0.50/$3.00 per 1M tokens)
- งานนี้ต้องการ judgment ระดับกลาง (pass/fail)
- Gemini 3 Flash เร็วและราคาดีสำหรับ batch processing
- ถ้า pass/fail ไม่แม่นพอ ให้ upgrade เป็น Claude Sonnet 4.6

---

## 5. AI Agent 3 — Ranking AI

### หน้าที่หลัก

ให้คะแนนและจัดอันดับ candidate ที่ผ่าน Stage 2 เพื่อหา Top 20-50

### สองวิธีที่ใช้ร่วมกัน

**วิธีที่ 1: Score Against JD (ทำก่อน)**
- ให้คะแนน 0-100 ต่อคน เทียบกับ criteria
- ทำ batch ได้ เร็ว
- ใช้ anchor candidates (3 คน: ดีมาก/กลาง/ไม่ดี) ใน every batch เพื่อ calibrate คะแนนให้สม่ำเสมอ
- Sort → ได้ Top 50

**วิธีที่ 2: Pairwise Comparison (ทำกับ Top 50)**
- เปรียบเทียบทีละ 2 คน "ใครดีกว่า?"
- แม่นยำกว่าแต่แพงกว่า
- ใช้เฉพาะ Top 50 → หา Top 20

### Batch Processing Flow

```
100-200 candidates ที่ผ่าน Stage 2
        ↓
N8N แบ่ง batch ละ 25 คน
        ↓
สำหรับแต่ละ batch:
  1. เรียก MCP ดึงข้อมูล 25 คน
     (เพิ่ม skills_list และ languages จาก Stage 2)
  2. ส่งให้ AI พร้อม anchor candidates
  3. AI ให้คะแนน 0-100 + strengths + gaps
  4. บันทึกคะแนนกลับเข้า Work ID
        ↓
Sort by score → Top 50
        ↓
Pairwise Comparison ใน Top 50
        ↓
Final Top 20 พร้อม ranking + เหตุผล
```

### Scoring Rubric (ตัวอย่าง)

```
คะแนนเต็ม 100 แบ่งเป็น:
  40 pts → ประสบการณ์ตรง (ตำแหน่ง + industry match)
  20 pts → ระยะเวลาประสบการณ์ (years of experience)
  20 pts → ความสามารถพิเศษที่ระบุ (specific skills)
  10 pts → ภาษา / สัญชาติ (ถ้า specify)
  10 pts → อื่นๆ (education, additional skills)
```

### Anchor Candidates (สำคัญมาก)

ต้องเลือก 3 คนไว้ล่วงหน้าและใส่ทุก batch เพื่อให้คะแนนสม่ำเสมอ:

```
Anchor High (score: 85):
  ตัวอย่างคนที่ดีมาก → AI calibrate คะแนนสูงไว้ที่นี่

Anchor Mid (score: 50):
  ตัวอย่างคนกลางๆ → AI calibrate คะแนนกลาง

Anchor Low (score: 20):
  ตัวอย่างคนที่ไม่ค่อยตรง → AI calibrate คะแนนต่ำ
```

### Prompt Template (Scoring)

```
Score each candidate against the criteria. Scale: 0-100.

Scoring weights:
- 40pts: Relevant experience (title + industry)
- 20pts: Years of experience
- 20pts: Specific required skills
- 10pts: Language/nationality
- 10pts: Education/other skills

Anchor references (calibrate your scores against these):
- ANCHOR_HIGH (85): {data}
- ANCHOR_MID (50): {data}
- ANCHOR_LOW (20): {data}

Criteria: {job_criteria}

Return JSON ONLY:
[{"id": "C00123", "score": 78, "strengths": "...", "gaps": "..."}]

Candidates:
{batch_of_25}
```

### Deep Read (เฉพาะกรณีที่จำเป็น)

ถ้า AI ต้องการข้อมูลเพิ่มเติม (เช่น verify "branch expansion experience"):
- เรียก MCP ดึง experience_summary เฉพาะ candidate_id นั้น
- ไม่ดึงทุกคน (แพงเกิน)
- ทำเฉพาะกรณีที่ semantic filter จาก user ต้องการ

### Model ที่แนะนำ

**Claude Sonnet 4.6** ($3.00/$15.00 per 1M tokens)
- Ranking ต้องการ reasoning ที่ดีกว่า
- ต้องเปรียบเทียบและ justify คะแนนได้
- Claude เก่งเรื่อง nuanced judgment มากกว่า Gemini ในงานนี้

---

## 6. UI Report — การแสดงผล

### Concept: Progressive Display

ไม่รอให้ AI ทำงานเสร็จทั้งหมดก่อน แต่แสดงผลทันทีที่มีข้อมูล

### ลำดับการแสดงผล

**ทันทีที่ Stage 1 เสร็จ:**
```
แสดงทันที: รายชื่อ 487 คน
สถานะ: "AI กำลังประเมิน candidate อยู่..."
ข้อมูลที่แสดง: ชื่อ, ตำแหน่ง, บริษัท, ประเทศ
```

**ระหว่างที่ Stage 2 ทำงาน (background):**
```
แสดง: 487 คน (ยังอยู่ครบ)
Progress bar: "Screened 75/487..."
Top section: ว่างอยู่ (รอ Stage 3)
```

**ระหว่างที่ Stage 3 ทำงาน (background):**
```
แสดง: 150 คนที่ผ่าน (filtered จาก 487)
Progress bar: "Ranking top candidates..."
Top section: เริ่มแสดง Top candidates ที่ประเมินแล้ว
```

**เมื่อเสร็จสมบูรณ์:**
```
Top section:   Top 20 candidates (ranked, with scores)
               พร้อม AI reasoning
Bottom section: รายชื่อทั้งหมด 150 คนที่ผ่าน screening
```

### ข้อมูลที่แสดงใน UI Report

**Top 20 Section:**
```
Rank | Photo | Name | Current Position | Company | Score | Match %
1    | 👤    | John | GM               | Marriott| 87    | 94%
2    | 👤    | Jane | Hotel GM         | Hilton  | 84    | 91%
...
```

**Candidate Card (เมื่อกดดูรายละเอียด):**
```
ชื่อ + LinkedIn
ตำแหน่งปัจจุบัน + บริษัท
AI Score: 87/100
Strengths: "15yr luxury hotel GM, managed 400 rooms, Marriott certified"
Gaps: "No Vietnam experience"
ประวัติการทำงาน (จาก candidate_experiences)
Skills, Languages, Education
```

**Full List Section:**
```
แสดง candidate ที่ผ่าน screening ทั้งหมด
Filter ได้: by score, by country, by company
Sort ได้: by score, by experience, by name
```

### Chat Integration

หลังจาก user เห็น UI Report แล้ว สามารถ chat ต่อได้:
```
User: "บอกรายละเอียดของคนอันดับ 3 หน่อย"
User: "ต้องการคนที่มีประสบการณ์ Vietnam เพิ่มด้วย"
User: "เพิ่ม budget hotel experience เข้าไปด้วยได้มั้ย"
        ↓
AI ปรับ criteria และ re-rank หรือ re-screen
        ↓
UI อัปเดตผล
```

---

## 7. Work ID — ตัวเชื่อมทุกอย่าง

### หน้าที่

Work ID (Job Order ID) เป็นตัวกลางที่เชื่อมทุก stage เข้าด้วยกัน และเชื่อมกับระบบ frontend

### โครงสร้าง Work ID Table

```sql
CREATE TABLE work_orders (
  work_id          TEXT PRIMARY KEY,  -- เช่น JO_20260428_001
  created_at       TIMESTAMP,
  user_id          TEXT,
  
  -- Query Info
  original_query   TEXT,              -- สิ่งที่ user พิมพ์
  refined_query    TEXT,              -- หลัง chatbot clarify
  search_criteria  JSONB,             -- criteria ที่ extracted
  semantic_filters JSONB,             -- สิ่งที่ SQL หาไม่ได้
  
  -- Stage 1 Results
  stage1_sql       TEXT,              -- SQL query ที่ใช้
  stage1_count     INTEGER,           -- จำนวน candidate ที่ได้
  stage1_status    TEXT,              -- pending/complete
  
  -- Stage 2 Results  
  stage2_count     INTEGER,           -- จำนวนที่ผ่าน screening
  stage2_status    TEXT,              -- pending/processing/complete
  stage2_progress  INTEGER,           -- batch ที่ทำแล้ว
  
  -- Stage 3 Results
  stage3_top_count INTEGER,           -- Top N ที่ได้
  stage3_status    TEXT,              -- pending/processing/complete
  stage3_progress  INTEGER,           -- batch ที่ทำแล้ว
  
  -- Final
  completed_at     TIMESTAMP
);
```

### Work Order Candidates Table

```sql
CREATE TABLE work_order_candidates (
  work_id          TEXT,
  candidate_id     TEXT,
  
  -- Stage 1
  stage1_included  BOOLEAN DEFAULT TRUE,
  
  -- Stage 2
  stage2_pass      BOOLEAN,
  stage2_reason    TEXT,
  
  -- Stage 3
  stage3_score     INTEGER,           -- 0-100
  stage3_rank      INTEGER,           -- 1, 2, 3, ...
  stage3_strengths TEXT,
  stage3_gaps      TEXT,
  
  PRIMARY KEY (work_id, candidate_id)
);
```

### ข้อดีของ Work ID System

```
✅ ไม่มี duplicate (same Work ID = same search)
✅ ไม่มี data lost (ทุก stage save กลับเข้า Work ID)
✅ Progressive display ได้ (อัปเดตทีละ stage)
✅ Frontend ดึงข้อมูลได้ตลอด (poll status)
✅ ระบบอื่นเชื่อมต่อได้ผ่าน Work ID
✅ User กลับมาดูผลเดิมได้ภายหลัง
```

---

## 8. N8N Workflow Orchestration

### ทำไมต้องใช้ N8N

```
✅ Visual workflow (เห็นภาพชัด)
✅ Built-in looping สำหรับ batch processing
✅ Error handling และ retry
✅ สามารถ pause/resume ได้
✅ เชื่อมต่อ Supabase MCP, Claude API, Gemini API ได้ง่าย
✅ Progressive update Work ID ได้ระหว่าง batch
```

### N8N Workflows ที่ต้องสร้าง

**Workflow 1: Chatbot Clarification**
```
Trigger: User ส่ง message ใน chat
  ↓
โหลด chat history จาก SQL
  ↓
Preliminary AI วิเคราะห์ว่า query ครบมั้ย
  ↓
ถ้าไม่ครบ → ส่ง clarifying question กลับ
ถ้าครบ → Trigger Workflow 2
```

**Workflow 2: Stage 1 SQL Filter**
```
Trigger: Query พร้อมแล้ว
  ↓
สร้าง Work ID
  ↓
Preliminary AI สร้าง SQL query
  ↓
เรียก Supabase MCP รัน SQL
  ↓
บันทึก candidate IDs ใน Work ID
  ↓
ส่งผล 487 คนไปแสดงใน UI ทันที
  ↓
Trigger Workflow 3 (background)
```

**Workflow 3: Stage 2 Screening**
```
Trigger: Stage 1 complete
  ↓
Loop: แบ่ง candidate IDs ทีละ 25
  ↓
  For each batch:
    เรียก MCP ดึงข้อมูล 25 candidates
    ส่งให้ Gemini 3 Flash Screening AI
    รับ pass/fail JSON
    Update work_order_candidates table
    Update stage2_progress ใน work_orders
  ↓
Stage 2 complete → Trigger Workflow 4
```

**Workflow 4: Stage 3 Ranking**
```
Trigger: Stage 2 complete
  ↓
ดึง candidate IDs ที่ stage2_pass = TRUE
  ↓
Loop: แบ่ง batch ละ 25
  ↓
  For each batch:
    เรียก MCP ดึงข้อมูล 25 candidates (+ anchor candidates)
    ส่งให้ Claude Sonnet 4.6 Ranking AI
    รับ score + strengths + gaps JSON
    Update work_order_candidates table
    Update stage3_progress ใน work_orders
  ↓
Sort by score → mark Top 20
  ↓
Stage 3 complete → Update UI
```

---

## 9. Model Selection & Cost

### Model ต่อ Workflow

| Workflow | Task | Model | Input | Output |
|----------|------|-------|-------|--------|
| Chatbot Clarification | ถาม-ตอบ, clarify | Gemini 2.5 Flash-Lite | $0.10/1M | $0.40/1M |
| Stage 1 SQL Generation | แปลง query → SQL | Gemini 2.5 Flash-Lite | $0.10/1M | $0.40/1M |
| Stage 2 Screening | Pass/Fail judgment | Gemini 3 Flash | $0.50/1M | $3.00/1M |
| Stage 3 Ranking | Score + Reasoning | Claude Sonnet 4.6 | $3.00/1M | $15.00/1M |

### ทำไม Hybrid (Gemini + Claude)?

```
Gemini ถูกกว่า → ใช้กับงานง่าย (clarify, filter, screen)
Claude แม่นกว่า → ใช้กับงานสำคัญ (ranking ที่ต้องการ nuanced reasoning)
```

### ประมาณการ Cost ต่อ Work Order

```
Workflow 1 (Clarification):       ~$0.001
Workflow 2 (Stage 1 SQL):         ~$0.002
Workflow 3 (Stage 2 - 487 คน):   ~$0.04
Workflow 4 (Stage 3 - 150 คน):   ~$0.08

รวมต่อ Work Order:               ~$0.12

100 Work Orders/เดือน:           ~$12/เดือน
```

### Tips ประหยัด Cost เพิ่มเติม

```
✅ Batch API — 50% discount สำหรับงานที่ไม่รีบ
✅ Prompt Caching — 90% discount สำหรับ system prompt ที่ซ้ำ
✅ Short context — ดึงแค่ field ที่จำเป็น ไม่ดึง long text ทุกครั้ง
✅ ใช้ Haiku/Flash-Lite สำหรับงานง่าย
✅ ใช้ Sonnet เฉพาะ Stage 3 เท่านั้น
```

---

## สรุปสั้นๆ

```
1. User พิมพ์ query → Chatbot clarify → ได้ criteria ที่ครบ
2. สร้าง Work ID → Stage 1 SQL via Supabase MCP → ได้ 487 คน
3. แสดง 487 คนทันที → AI ทำงาน background (Stage 2 + 3)
4. Stage 2: Batch 25 คน → Pass/Fail → เหลือ 150 คน
5. Stage 3: Batch 25 คน → Score 0-100 → Top 20
6. UI อัปเดต → แสดง Top 20 ที่ด้านบน + รายชื่อทั้งหมดด้านล่าง
7. User chat ต่อได้เพื่อ refine หรือดูรายละเอียด
```

---

*สร้างโดย Claude AI | April 2026 | ATS Candidate Search & Scoring System*
