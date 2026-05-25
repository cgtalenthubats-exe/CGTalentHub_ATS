# Stage 3 AI Ranking System — Context & Architecture

> **ACTIVE FOLLOW UP** — ระบบนี้ทำงานอยู่แล้วใน JR Manage page  
> งานที่ต้องทำต่อคือ bring กลับมาใช้ใน AI Search Demo page ด้วย  
> อ่านไฟล์นี้ก่อนทุกครั้งที่แตะ Stage 3 ranking, ai_ranking_jobs, ai-suggestion-tab, หรือ ai-ranking actions

---

## ประวัติ

- **commit c33d290** (6 May 2026) — สร้าง AI Search Demo พร้อมปุ่ม "ประเมิน Stage 2 & 3" (ยังไม่ wire)
- **commit d068ac9** — ลบปุ่มออกจาก AI Search Demo พร้อม chat widget ("Remove chat widget and Stage 2&3 evaluate button from AI Search Demo")
- **ปัจจุบัน** — ระบบ Stage 3 ยังทำงานอยู่เต็มรูปแบบใน `/requisitions/manage` → tab "AI Suggestion"

> **Note เรื่อง Stage 2:** ตัดสินใจแล้วว่า Stage 2 (screen pass/fail) ไม่จำเป็น เพราะ Stage 1 filter precise อยู่แล้ว  
> ระบบปัจจุบันข้าม Stage 2 ไปเลย → Stage 1 → Stage 3 โดยตรง

---

## Architecture ปัจจุบัน (Stage 3 ใน JR Manage)

```
User กด "Analyse Candidates" ใน JR Manage
        ↓
triggerStage3Ranking(jrId, query)
  - ดึง candidate_ids จาก jr_candidates WHERE jr_id = X
  - สร้าง job_id (UUID)
  - POST → n8n webhook: https://n8n.srv1212906.hstgr.cloud/webhook/demo-stage3
        { job_id, candidate_ids[], candidate_count, query, jr_id }
        ↓
n8n ทำงาน (ประมาณ 1–5 นาที)
  - รับ candidate_ids
  - ดึงข้อมูลจาก Supabase (profile + experiences)
  - ส่ง Claude AI ประเมินทีละคน
  - INSERT ผลเข้า ai_ranking_results (ทีละ row, status='done')
  - UPDATE ai_ranking_jobs.status = 'completed' + summary
        ↓
Frontend polling getStage3JobStatus(jobId, jrId) ทุก 3 วินาที
  - ดึง ai_ranking_results WHERE job_id = X AND status = 'done'
  - แสดงผลแบบ progressive (real-time เห็นทีละคน)
```

---

## Database Tables

### `ai_ranking_jobs`
| Column | Type | หมายเหตุ |
|---|---|---|
| job_id | text PK | UUID สร้างใน Next.js |
| query | text | คำถามที่ user ใส่ เช่น "Find GM Hotel 5 Star Thailand" |
| candidate_count | integer | จำนวนคนที่ส่งไปประเมิน |
| status | text | `pending` → `running` → `completed` / `failed` |
| result_count | integer? | จำนวนผลที่ได้กลับมา (set ตอน completed) |
| summary | jsonb? | `{ highlights[], top5[], final_recommendation }` |
| candidate_ids | jsonb? | backup ของ candidate_ids ที่ส่งไป (optional) |
| **jr_id** | text? | **NULLABLE** ← สำคัญ: รองรับ non-JR mode อยู่แล้ว |
| created_at / updated_at | timestamptz | |

### `ai_ranking_results`
| Column | Type | หมายเหตุ |
|---|---|---|
| id | bigint PK | auto |
| job_id | text FK | → ai_ranking_jobs.job_id |
| candidate_id | text | |
| score | integer | Overall score 0–100 |
| strengths | text | |
| gaps | text | |
| tradeoff | text | |
| rank | integer | ลำดับ (1 = ดีที่สุด) |
| status | text | `done` / `error` |
| experience_score | integer? | /25 |
| experience_summary | text? | |
| leadership_score | integer? | /25 |
| leadership_summary | text? | |
| market_score | integer? | /25 |
| market_summary | text? | |
| skills_score | integer? | /25 |
| skills_summary | text? | |

**4-dimension scoring รวม = 100 คะแนน**: experience(25) + leadership(25) + market(25) + skills(25)

---

## Files ที่เกี่ยวข้อง

| File | ทำอะไร |
|---|---|
| `src/app/actions/ai-ranking.ts` | Server actions: `triggerStage3Ranking`, `getStage3JobStatus`, `getLatestJobForJR`, `getJobHistoryForJR` |
| `src/app/requisitions/manage/ai-suggestion-tab.tsx` | UI Component เต็มรูปแบบ — ใช้เป็น reference สำหรับหน้า AI Search Demo |
| `src/app/requisitions/manage/page.tsx` | Mount `AiSuggestionTab` component |

---

## n8n Workflow

- **Webhook URL**: `https://n8n.srv1212906.hstgr.cloud/webhook/demo-stage3`
- **Workflow ID**: ต้องตรวจสอบใน n8n (ใช้ MCP หรือ API key)
- **Input payload**:
  ```json
  {
    "job_id": "uuid",
    "candidate_ids": ["C00001", "C00002", ...],
    "candidate_count": 30,
    "query": "Find GM Hotel 5 Star in Thailand",
    "jr_id": "JR000214"
  }
  ```
- **Output**: n8n INSERT ผลเข้า `ai_ranking_results` โดยตรงผ่าน Supabase node
- **Status update**: n8n UPDATE `ai_ranking_jobs.status = 'completed'` + `summary` เมื่อเสร็จ

---

## แผนงาน: Bring Stage 3 กลับมาใน AI Search Demo

### ทำไมทำได้
- `ai_ranking_jobs.jr_id` เป็น **NULLABLE** แล้ว → ไม่ต้องแก้ schema
- n8n รับ `candidate_ids[]` โดยตรง → ไม่ต้องอ้างอิง JR
- UI Component (`AiSuggestionTab`) ทำงานดีแล้ว → reuse หรือ adapt ได้

### สิ่งที่ต้องทำ

**1. แก้ `triggerStage3Ranking` ให้รับ `candidate_ids[]` โดยตรง**

ปัจจุบัน function ดึง candidate_ids จาก `jr_candidates` → ต้องเพิ่ม overload:

```typescript
// Mode A: จาก JR (เดิม)
export async function triggerStage3Ranking(jrId: string, query: string)

// Mode B: จาก AI Search Demo (ใหม่)
export async function triggerStage3RankingDirect(candidateIds: string[], query: string)
// → ส่ง jr_id: null ไปให้ n8n / ai_ranking_jobs
```

**2. แก้ `getStage3JobStatus` ให้ไม่ require `jrId`**

ปัจจุบัน join `jr_candidates` เพื่อดึง `list_type` → ถ้าไม่มี JR ให้ default `list_type = "Search Result"`

**3. เพิ่ม UI ใน AI Search Demo page**

หลังกด Search ได้ผลแล้ว → แสดงปุ่ม "Analyse & Rank (Stage 3)"
- UI design: ดู `AiSuggestionTab` เป็น reference
- แสดง query input → กด Analyse → polling → progressive results

**4. ตรวจสอบ n8n workflow `demo-stage3`**
- ยืนยัน webhook active
- ตรวจสอบว่า `jr_id = null` ไม่ทำให้ workflow error
- ดู execution log ล่าสุด

### Impact Assessment
- ไม่กระทบหน้า JR Manage เลย (แยก flow กัน, table เดียวกันแต่ filter ด้วย job_id)
- ไม่ต้องแก้ schema DB
- เฉพาะแก้ server action + เพิ่ม UI ใน AI Search Demo page

---

## UI Reference (AiSuggestionTab)

Component ที่ทำงานดีแล้วใน JR Manage มี:
- **Query input** (Textarea) — user ใส่ role requirement
- **Category buttons** — Overall / Experience / Leadership / Market / Skills
- **Score bars** — per category, color-coded (green ≥75%, amber ≥55%, red <55%)
- **Rank badges** — #1 gold, #2-3 silver, rest grey
- **Progressive display** — แสดง candidates ทีละคนเมื่อ n8n ส่งผลกลับมา
- **Summary banner** — highlights + final_recommendation (ปรากฏเมื่อ completed)
- **Job history** — ดู runs ก่อนหน้าได้ (ถ้า bring มาใน Demo อาจไม่ต้องมี)

---

*Last updated: 2026-05-21 | Stage 3 Ranking System v1*
