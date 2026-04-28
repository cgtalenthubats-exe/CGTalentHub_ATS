# ATS Project — Progress Log

> **อัปเดตล่าสุด:** April 28, 2026  
> **เครื่องที่ทำ:** HP (Windows)  
> **Stack:** Supabase · Next.js · Claude Code · n8n (Hostinger)

---

## สิ่งที่ทำเสร็จแล้ววันนี้

### 1. Supabase MCP เชื่อมกับ Claude Code ✅
- สร้าง `.mcp.json` ที่ root project (อยู่ใน `.gitignore` ไม่ push ขึ้น GitHub)
- ใช้ Personal Access Token จาก supabase.com/dashboard/account/tokens
- เครื่องใหม่ต้องสร้าง `.mcp.json` ใหม่เอง (ดู format ด้านล่าง)

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--access-token",
        "YOUR_SUPABASE_PAT",
        "--project-ref",
        "ddeqeaicjyrevqdognbn"
      ]
    }
  }
}
```

---

### 2. country table — เพิ่ม region column ✅
- เพิ่ม column `region` เข้า `public.country`
- แบ่งเป็น: Middle East, Southeast Asia, East Asia, South Asia, Central Asia, Europe, Africa, North America, South America, Oceania, Europe/Asia
- ใช้สำหรับให้ Preliminary AI แปล "Middle East" → list ประเทศจริงใน DB

---

### 3. position_keyword — Tier 1 Rule-based SQL ✅
- เขียน SQL CASE UPDATE เข้า `candidate_experiences.position_keyword`
- ผลลัพธ์: **88.8% mapped** (33,403 จาก 37,617 rows)
- vocab v1 มี ~55 ค่า บันทึกไว้ใน `docs/position_keyword_vocab.md`

---

### 4. company_master — prefix inherit ✅
- resolve 243 masters ที่ `Wait AI Check` โดยใช้ prefix matching กับ master เดิมที่มี industry แล้ว
- เหลือ **1,164 masters** ที่ยังต้องให้ AI เติม

---

## งานที่รอ n8n ทำต่อ

> Prompt templates ทั้งหมดอยู่ใน `docs/n8n_ai_batch_prompts.md`

| งาน | จำนวน | สถานะ |
|---|---|---|
| position_keyword Tier 2 — AI map ที่เหลือ | ~4,200 rows | ⏳ รอ n8n |
| company_master — เติม industry/group | 1,164 masters | ⏳ รอ n8n |
| company_master — เติม rating ดาวโรงแรม | ~1,900 masters | ⏳ รอ n8n |
| Fix rating format (4 Star vs 5 Stars) | เล็กน้อย | ⏳ รอทำ |

---

## งานถัดไปที่ต้องทำ (ยังไม่ได้เริ่ม)

### Stage 1 — Preliminary AI System Prompt
ต้องเขียน system prompt ให้ AI แปล natural language → SQL filters
สิ่งที่ต้องใส่ใน prompt:
- Schema ทุก field พร้อมคำอธิบาย
- company_group 6 ค่า, position_level 6 ค่า
- vocab list ของ position_keyword (~55 ค่า)
- region mapping (Middle East = UAE, Saudi ฯลฯ) → JOIN country table
- กฎการแปลคำ เช่น "Viet Kieu", "4-5 star hotel"
- logic ขยาย/ลด query (<50 คน / >1,000 คน)
- output format JSON

### Stage 1 — ทดสอบ end-to-end
รอ n8n เติม position_keyword Tier 2 เสร็จก่อน แล้วทดสอบ query จริง 5-10 cases

### Stage 2 — AI Screening
ยังไม่ได้ออกแบบละเอียด — รอ Stage 1 เสถียรก่อน
แนวคิด: batch ละ 25 คน, ส่ง JD + ข้อมูลสรุป, AI ตอบ pass/fail + เหตุผล

### Stage 3 — AI Ranking
ยังไม่ได้เริ่ม — รอ Stage 2 เสร็จก่อน

---

## ไฟล์สำคัญที่ต้องรู้จัก

| ไฟล์ | อยู่ที่ไหน | คืออะไร |
|---|---|---|
| `docs/position_keyword_vocab.md` | repo | vocab v1 พร้อมเหตุผลการออกแบบ |
| `docs/n8n_ai_batch_prompts.md` | repo | prompt templates สำหรับ n8n ทุกงาน |
| `docs/ATS_Project_Plan.md` | Downloads (ไม่ได้อยู่ใน repo) | ภาพรวม architecture ทั้งหมด |
| `.mcp.json` | root (gitignored) | ต้องสร้างใหม่บนเครื่องใหม่ |

---

## DB Tables ที่ใช้หลักๆ

| Table | ใช้ทำอะไร |
|---|---|
| `candidate_experiences` | ประวัติการทำงาน — มี position_keyword, position_level |
| `Candidate Profile` | ข้อมูลหลัก candidate |
| `candidate_profile_enhance` | nationality, country, languages, skills, summaries |
| `company_master` | master บริษัท — มี industry, group, rating |
| `company_variation` | ชื่อบริษัท variant ต่างๆ → map กลับ company_master |
| `country` | รายชื่อประเทศ + continent + **region (เพิ่งเพิ่ม)** |
| `job_requisitions` | JD ที่มีอยู่ในระบบ |

---

## หมายเหตุสำคัญ

- `candidate_experiences.country` ผ่านการ cleanse แล้ว ตรงกับ `country.country`
- `position_keyword` ตอนนี้เป็น best guess v1 — จะ iterate หลังได้ feedback จากการใช้งานจริง
- `company_master.rating` format ยังไม่ consistent — fix ก่อน query ด้วย rating
- Preliminary AI ต้องการ vocab list และ region mapping ใน system prompt — ยังไม่ได้เขียน