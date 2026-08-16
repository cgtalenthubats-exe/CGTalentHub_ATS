# AI Power Search V2 — ภาพรวมระบบ

> **Last updated:** April 2026  
> **Status:** Stage 1-3 built and tested

---

## Architecture

```
User (Chat) → Stage 1 (SQL Search) → Stage 2 (Pass/Fail) → Stage 3 (Score + Insights)
                                                                        ↓
                                                              Report Tab (4 sections)
```

---

## Stage 1 — SQL Search

**ประเภท:** n8n AI Agent (Claude Sonnet + tools: executeSQL, triggerWebhook)  
**Webhook:** `POST /webhook/v2-stage1` (chat assistant)  
**Input:** user message + session_id + user_email

### ขั้นตอน
1. STEP 0 — Load `industry_group` table เป็น vocabulary
2. STEP 1 — ถาม clarify role / industry / location (+ optional: hotel_rating, seniority)
3. STEP 2 — Confirm กับ user ก่อนรัน
4. STEP 3 — Lookup `industry_group` + `country` tables สำหรับค่า exact
5. STEP 4 — เช็คว่า session มี results อยู่แล้วมั้ย
6. STEP 5 — INSERT ลง `v2_search_results` (max 600 คน) → count breakdown
7. STEP 5.5 — Query company count + sample names + sample candidates
8. STEP 6 — Trigger Stage 2 webhook
9. STEP 7 — ตอบ user

### Tables ที่ใช้
- `candidate_experiences` — career history, position_keyword, is_current_job, country
- `company_master` — group, industry, rating
- `country` — country, region
- `industry_group` — vocabulary lookup
- `v2_search_results` — INSERT candidates
- `v2_search_sessions` — UPDATE status + count

### Response ที่ user เห็น
```
✅ พบผู้สมัครเบื้องต้น X คน จาก Y บริษัท/โรงแรม
🟢 ดำรงตำแหน่งอยู่ปัจจุบัน: Z คน | 🔵 เคยดำรงตำแหน่ง: W คน
🏢 ตัวอย่างที่พบ: Marriott, Hilton, ...
👤 ตัวอย่างผู้สมัคร: Name — Position at Company
```

---

## Stage 2 — Pass/Fail Screening

**ประเภท:** n8n chainLlm (Claude Haiku 4.5)  
**Webhook:** `POST /webhook/v2-stage2`  
**Input:** `{ session_id }`

### ขั้นตอน
1. Get session criteria จาก `v2_search_sessions`
2. ดึง candidates ที่ `stage1_included = true AND stage2_pass IS NULL`
3. Loop batch 25 คน → fetch career history
4. Claude Haiku ตัดสิน pass/fail + reason (max 15 words)
5. UPDATE `stage2_pass` + `stage2_reason` กลับลง DB
6. เมื่อ loop เสร็จ → mark `stage2_status = 'completed'` → trigger Stage 3

### Fields ที่อัพเดท
| Field | ค่า |
|-------|-----|
| `stage2_pass` | true / false |
| `stage2_reason` | เหตุผลสั้นๆ |

### ผลลัพธ์
คัดจาก ~600 เหลือ ~50-80 คนที่ผ่าน

---

## Stage 3 — Scoring + Insights

**ประเภท:** n8n chainLlm (Claude Sonnet 4.6)  
**Webhook:** `POST /webhook/v2-stage3`  
**Input:** `{ session_id }`

### ขั้นตอน
1. ดึง candidates ที่ `stage2_pass = true AND stage3_score IS NULL`
2. Loop batch 10 คน → fetch career history
3. Claude Sonnet ให้คะแนน 0-100 + เขียน strengths / gaps / tradeoff
4. UPDATE ผลกลับลง `v2_search_results`
5. เมื่อ loop เสร็จ → Assign ranks (ROW_NUMBER by score)
6. ดึง Top 20 → Claude Sonnet เขียน AI Insights (structured JSON)
7. Save `stage3_overall_summary` ลง `v2_search_sessions`
8. Mark `stage3_status = 'completed'`

### Scoring Rubric (100 คะแนน)
| มิติ | คะแนน |
|------|--------|
| Role match | 0-40 |
| Industry match | 0-30 |
| Seniority | 0-20 |
| Location | 0-10 |

### Fields ที่อัพเดท (v2_search_results)
| Field | เนื้อหา |
|-------|---------|
| `stage3_score` | 0-100 |
| `stage3_rank` | อันดับ (1 = ดีสุด) |
| `stage3_strengths` | ทำไมถึงเหมาะ (1-2 ประโยค) |
| `stage3_gaps` | ความเสี่ยงหลัก |
| `stage3_tradeoff` | สิ่งที่ hiring manager ควรพิจารณา |

### AI Insights (stage3_overall_summary — JSON)
```json
{
  "highlights": ["bullet 1", "bullet 2", "bullet 3"],
  "top5": [
    { "name": "...", "rank": 1, "score": 90, "why": "...", "risk": "...", "tradeoff": "..." }
  ],
  "final_recommendation": "..."
}
```

---

## หน้า Report — 4 Sections

| Section | เงื่อนไข | การแสดงผล |
|---------|----------|-----------|
| 🏆 Top Matches | stage2_pass ≠ false + stage3_score != null (rank 1-20) | Score ring + rank badge + strengths + tradeoff |
| 📋 Other Scored | stage2_pass ≠ false + stage3_score != null (rank 21+) | Score ring (ไม่มี rank badge) |
| ⏳ Pending Analysis | stage2_pass ≠ false + stage3_score = null | รอ Stage 3 |
| ❌ Not Qualified | stage2_pass = false | Red border + reason badge |

**AI Insights block** (บนสุด): แสดง highlights + top 5 mini-analysis (why/risk/tradeoff) + final recommendation pill

---

## Database Tables

| Table | หน้าที่ |
|-------|---------|
| `v2_search_sessions` | session metadata, status, counts, overall_summary |
| `v2_search_results` | candidates + stage1/2/3 fields |
| `v2_chat_messages` | chat history |
| `v2_pipeline_status` | pipeline progress display |

---

## สิ่งที่ยังต้องทำ

- [ ] Stage 1: save `search_criteria` (SQL + structured criteria) ลง `v2_search_sessions` เพื่อ audit trail
- [ ] Fine-tune Stage 1 prompt (hotel company list, location handling)
- [ ] Wire Stage 1 Step 6 → Stage 2 → Stage 3 ครบ loop อัตโนมัติ
- [ ] Test full pipeline end-to-end
