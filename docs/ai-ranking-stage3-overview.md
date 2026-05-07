# AI Ranking — Stage 3 Pipeline Overview

## ภาพรวม

Stage 3 คือขั้นตอน AI ประเมินและจัดอันดับ candidate ที่อยู่ใน Job Requisition (JR) โดย recruiter เป็นคนกด trigger แล้วระบบทำงานอัตโนมัติผ่าน n8n ทั้งหมด

---

## Architecture: 3 Workflows

```
Frontend (กด Analyse)
    ↓ POST /webhook/demo-stage3
[Workflow A] — รับ webhook, สร้าง job + insert candidates เป็น pending
    ↓ (ทุก 3 นาที)
[Workflow B] — ประเมินรายคน ด้วย Claude Sonnet (batch 20)
    ↓ (ทุก 3 นาที)
[Workflow C] — สรุปผล, จัดอันดับ, เขียน final recommendation
```

---

## Workflow A — รับ Trigger & Setup

**Trigger:** POST webhook จาก frontend (`/webhook/demo-stage3`)

**Input:**
- `job_id` — UUID ที่ frontend สร้างขึ้น
- `candidate_ids[]` — รายชื่อ candidate ทั้งหมดใน JR
- `query` — criteria ที่ recruiter พิมพ์ (เช่น "General Manager 5-star hotel Thailand")
- `jr_id` — Job Requisition ID

**ทำอะไร:**
1. Insert record เข้า `ai_ranking_jobs` (status = `ready_to_analyse`)
2. Insert candidate ทุกคนเข้า `ai_ranking_results` (status = `pending`)

---

## Workflow B — Per-Candidate AI Evaluation

**Trigger:** Schedule ทุก 3 นาที

**หลักการ:** Atomic lock batch ละ 20 คน เพื่อป้องกัน race condition

**ขั้นตอน:**

1. **Reset Stuck** — คืนสถานะ candidate ที่ค้างเป็น `working` นานเกิน 10 นาที → กลับเป็น `pending`

2. **Get Ready Job** — หา job ที่ status = `ready_to_analyse` และยังมี candidate `pending` อยู่ (เรียง queue ตาม `created_at`)

3. **Lock 20 Candidates** — `UPDATE ... SET status = 'working' WHERE status = 'pending' LIMIT 20 RETURNING candidate_id` (atomic)

4. **Fetch Experiences** — ดึงข้อมูลแต่ละคนจาก:
   - `Candidate Profile` — ชื่อ
   - `candidate_experiences` — ตำแหน่งปัจจุบัน, บริษัทปัจจุบัน (is_current_job = 'Current')

5. **Format for AI** — รวม candidates ทั้ง 20 เป็น JSON array พร้อม query

6. **Evaluate (Claude Sonnet 4.5)** — ส่ง prompt:
   - Role: Executive HR recruiter
   - Input: `query` + candidates JSON array (candidate_id, name, current_position, current_company)
   - Output: JSON array ของทุกคนพร้อม score, strengths, gaps, tradeoff

7. **Parse Results** — แกะ JSON array จาก AI response, รองรับ markdown fences

8. **Save Results** — PATCH `ai_ranking_results` ทีละคน:
   - `score` (0–100)
   - `strengths` (1–2 ประโยค)
   - `gaps` (1 ประโยค)
   - `tradeoff` (1 ประโยค)
   - `status = 'done'`

9. **Check All Done** — ตรวจว่ายังมี `pending` หรือ `working` เหลืออยู่มั้ย

10. **Mark Pending Summary** — ถ้าเสร็จทุกคน → update job status = `pending_summary`

---

## Workflow C — Ranking & Summary

**Trigger:** Schedule ทุก 3 นาที (หา job ที่ status = `pending_summary`)

**ทำอะไร:**
1. ดึง results ทั้งหมดของ job นั้น เรียงตาม score
2. คำนวณ rank (1, 2, 3, ...)
3. แยก Top Profile vs Longlist (ตาม `jr_candidates.list_type`)
4. ส่ง top candidates กลับไปให้ Claude Sonnet สรุปภาพรวม:
   - `highlights[]` — จุดเด่นของ pool นี้
   - `final_recommendation` — สรุปแนะนำ 1 ประโยค
5. บันทึก summary + rank ลง `ai_ranking_jobs` (status = `completed`)

---

## ข้อมูลที่ใช้ในการประเมิน

| ข้อมูล | มาจาก |
|--------|-------|
| ชื่อ candidate | `Candidate Profile.name` |
| ตำแหน่งปัจจุบัน | `candidate_experiences.position` (is_current_job = 'Current') |
| บริษัทปัจจุบัน | `candidate_experiences.company` (is_current_job = 'Current') |
| Criteria | `ai_ranking_jobs.query` (recruiter พิมพ์) |
| List type | `jr_candidates.list_type` (Top Profile / Longlist) |

> **หมายเหตุ:** AI ใช้แค่ชื่อ + ตำแหน่ง + บริษัทปัจจุบันเท่านั้น ไม่ได้ส่งประวัติการทำงานทั้งหมด เพื่อควบคุมขนาด prompt และ cost

---

## Frontend — Progressive Display

- กด **Analyse** → frontend poll ทุก 4 วินาที
- แสดงผลแบบ progressive ทันทีที่มี candidate `done` แม้ยังไม่ครบ
- เมื่อ status = `completed` → แสดง summary banner + final recommendation
- รีเปิดหน้าทีหลัง → restore ผลเดิมจาก DB อัตโนมัติ (ไม่ต้อง run ใหม่)

---

## Tables ที่เกี่ยวข้อง

| Table | บทบาท |
|-------|-------|
| `ai_ranking_jobs` | เก็บ job แต่ละครั้ง (query, status, summary, result_count) |
| `ai_ranking_results` | เก็บผลรายคน (score, strengths, gaps, tradeoff, rank, status) |
| `jr_candidates` | เชื่อม candidate กับ JR + list_type |
| `Candidate Profile` | ชื่อ candidate |
| `candidate_experiences` | ประสบการณ์ปัจจุบัน |

---

## AI Model

- **Workflow B (ประเมินรายคน):** Claude Sonnet 4.5 — batch 20 คน/รอบ
- **Workflow C (สรุป):** Claude Sonnet 4.5 — สรุปภาพรวมครั้งเดียว
- **Processing time:** ประมาณ 5–15 นาที ขึ้นอยู่กับจำนวน candidate
