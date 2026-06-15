# AI Search V3 — แผนการพัฒนา & สถานะปัจจุบัน

*Last updated: 2026-06-16*

> เอกสารนี้คือ source of truth ของ V3 — ก่อนแก้ส่วนไหน เช็ค status ในนี้ก่อนว่าทำแล้วหรือยัง เพื่อไม่ recreate ของซ้ำ

---

## บริบทของระบบ

**AI Search V2** (`/ai-search-demo`) — ใช้งานจริง, filter panel + manual "Evaluate" → Stage3 ทุก candidate ที่เลือก (cost สูงถ้าเลือกเยอะ)

**AI Search V3** (`/ai-search-v3`) — กำลังพัฒนา, chat-first + filter panel ทำงานร่วมกัน, ใช้ 3-stage pipeline เพื่อคุม cost (Stage 3 ประมวลผลแค่ top 20 เสมอ)

---

## 3-Stage Pipeline (ภาพรวม)

```
Stage 1 — SQL Search (broad)        → pool (200-1000 คน) + session_id
Stage 2 — Vector Ranking             → top 20 (vector similarity บน JD)
Stage 3 — Assessment (A/B/C)         → score 4 มิติ + summary, ผ่าน job_id
```

หลักการ: Stage 1 หา broad criteria (role/location/industry) เท่านั้น ส่วน criteria ซับซ้อน (market knowledge, P&L, brand expansion ฯลฯ) ให้ Stage 2 (vector) + Stage 3 (LLM assessment) จัดการ

---

## Path 1 / 2 / 3 — Fork ตามวิธี user สั่งงาน

```
                    User Input
                        │
       ┌────────────────┼────────────────────┐
       │                │                     │
   action button    free question        action button
   "AI Assessment"   (default, ไม่กด     "Apply to filters"
       │             ปุ่มอะไร)                │
       ▼                ▼                     ▼
   PATH 1            PATH 2                PATH 3
   ข้าม Agent        Agent Manager          ใช้ filters JSON
   Manager ไป        + sub-agent tools      ที่ parse ไว้แล้ว
   workflow แยก      (MCP Research /        จาก Stage 1 response
   (vector-rank      Vector rank /          → apply เข้า
   → Stage3 A/B/C)   batch-categorize /     FilterPanel
   → job_id          web search)
   → Stage3ResultsPanel
```

- **Path 1 (2026-06-16 ขึ้นไป — decoupled จาก chatbot)**: กด "AI Analyse" (ปุ่มใหม่ ใต้ filter panel, แยกจาก chat) → กรอก "AI Criteria" textarea → frontend gen `session_id = v2_<epoch>` เอง + insert `allCandidateIds` (จาก FilterPanel/search ปัจจุบัน เหมือน V2) เข้า `v2_search_results` (Supabase A, minimal `{session_id, candidate_id}`) → เรียก `/vector-rank` ด้วย `{session_id, jd_text: criteria, query: criteria}` → ได้ `{job_id, session_id, candidate_count, top20}` → set `activeJobId`/`jobIdInput` → `Stage3ResultsPanel` poll แสดงผล (reuse ของเดิม)
- **Path 1 (เดิม, chat-driven — ยัง dormant ไว้ ไม่ลบ)**: กด "AI Assessment" ใต้ assistant message ที่มี `session_id` รูปแบบ `v2_...` → `runAIAssessment` ยิง `/vector-rank` ด้วย `session_id`/`jd_text` จาก chatbot response — เก็บไว้เป็น fallback/debug ตาม "เก็บไว้ก่อน" แต่ไม่ใช่ flow หลักอีกต่อไป
- **Path 2**: ไม่กดปุ่มอะไร ถามอิสระในแชท → Agent Manager เลือก sub-agent tool ตามคำถาม → ตอบในแชทเลย ไม่มี `job_id`, ไม่ trigger Stage3
- **Path 3**: กด "Apply to filters" → เอา `filters` JSON ที่ Agent ส่งมาด้วย search response → set ลง `FilterPanel`

อ้างอิง Figma: https://www.figma.com/board/fgBYUjbrPabP457KXTCU8V (มี Path1=น้ำเงิน, Path2=ส้ม) — **ยังไม่ได้ใส่ "4th mechanism" (batch categorize) ด้านล่าง**

---

## สถานะรายชิ้น (Component Status)

### ✅ เสร็จแล้ว

| Component | รายละเอียด |
|---|---|
| **Stage 1 — n8n `New Chat bot`** (`4VR7FQMgPflospMd`, ACTIVE, webhook `/ai-search-chat`) | Main Agent (Gemini 3.1 Flash Lite) + MCP Research sub-agent (SQL specialist, CTE-based, ROW_NUMBER scoping) + Web Search tool. Output: `{total, session_id, filters, sample}` → save pool ลง `v2_search_results` (Supabase A) |
| **Stage 2 — n8n `Vector Ranking — Stage 2`** (`QBFXibNKEWc54uGJ`, ACTIVE, webhook `/vector-rank`) | Input `{session_id, jd_text, query}` → `Get Pool (A)` ดึง pool จาก `v2_search_results` (Supabase A, `WHERE session_id=$1 AND stage1_included=true`) → embed jd_text (Vertex `text-embedding-005`) → `Rank Candidates (B)`: `rank_candidates_by_vector` (Supabase B, p_limit=20, จุดเดียวที่แตะ Supabase B และเป็น internal call ของ n8n) → `Create Session (A)`: insert `ai_search_sessions` (Supabase A) → trigger Stage3 Workflow A (`/webhook/search-stage3`) → return `{job_id, session_id, candidate_count, top20}`. **ทดสอบแล้ว** (`job_1781414261624` status=completed, result_count=19) |
| **Stage 3 — Workflow A/B/C** (`8IBVcjjKvxTNtteE` / `0FQ1takGMELogWRZ` / `N6NC8Tp0vg0C5Qk8`) | Reuse จาก V2 ทั้งหมด — Receive&Queue / Per-candidate eval (Gemini) / Summary&Rank (Sonnet) |
| **Stage 3 — Webhook chaining A→B→C** (2026-06-16) | เพิ่ม webhook trigger ต่อกันเพื่อให้ผลออกเร็วขึ้น (ไม่ต้องรอ schedule 2 นาที): A เพิ่ม node "Trigger Stage3 B" (httpRequest POST → `/webhook/search-stage3-b`) ต่อท้าย Respond → B เพิ่ม "Webhook Trigger B" (รับ `/webhook/search-stage3-b`, fan-in เข้า "Reset Stuck Working") และ "Trigger Stage3 C" (httpRequest POST → `/webhook/search-stage3-c`, ยิงหลัง "Mark Pending Summary") → C เพิ่ม "Webhook Trigger C" (รับ `/webhook/search-stage3-c`, fan-in เข้า "Get Pending Summary Job"). **Schedule 2min ของ B และ C ยังคงไว้เป็น fallback** (เผื่อ webhook call ล้มเหลว job จะไม่ค้าง) — ตาม decision ที่ user confirm ("ก็ได้") |
| **Frontend: `Stage3ResultsPanel.tsx`** | สร้างใหม่ session นี้ — poll `getSearchJobStatus(jobId)` ทุก 4s, แสดง category tabs (overall/experience/leadership/market/skills), rank badges, score bars, summary banner เมื่อ completed |
| **Frontend: `/ai-search-v3` chat + filter** | Chat เรียก `/ai-search-chat`, มี job_id input + dropdown ประวัติ job ล่าสุด 20 รายการ (`getSearchJobHistory`) ต่อกับ `Stage3ResultsPanel` (ใช้ทดสอบ Step5 — ได้ผลแล้ว) |
| **Path 3 — action button "Apply to filters"** | ✅ เสร็จแล้ว — `applyFiltersFromAI` ไม่ auto-run แล้ว, แต่ละ assistant message ที่มี filters ที่มีความหมาย (`hasMeaningfulFilters`) จะมีปุ่ม "Apply to filters" ใต้ข้อความ กดแล้วค่อย set filters + runSearch ([page.tsx](../src/app/ai-search-v3/page.tsx)) |
| **Path 1 (ใหม่) — "AI Analyse" button, decoupled จาก chat** | ✅ เสร็จแล้ว (2026-06-16) — `triggerVectorRankAssessment(candidateIds, criteria)` ([ai-search-ranking.ts](../src/app/actions/ai-search-ranking.ts)): gen `session_id = v2_<epoch>` → bulk insert `v2_search_results` (Supabase A, `{session_id, candidate_id}`, `stage1_included` ใช้ default=true) → POST `/vector-rank` กับ `{session_id, jd_text: criteria, query: criteria}` → return `{jobId, sessionId, candidateCount}`. UI: "AI Criteria" textarea + ปุ่ม "AI Analyse" เหนือ job_id row ใน `/ai-search-v3` ([page.tsx](../src/app/ai-search-v3/page.tsx)) — disabled ถ้าไม่มี `allCandidateIds` หรือ criteria ว่าง, success → `setActiveJobId`/`setJobIdInput`/`getSearchJobHistory(20)` → `Stage3ResultsPanel` แสดงผล. `tsc --noEmit` ผ่าน (ไม่มี error ใหม่). **ยังไม่ live-test ผ่าน UI จริง** |
| **Path 1 (เดิม) — action button "AI Assessment" ในแชท** | ✅ ทำไว้ก่อนหน้า, **ตอนนี้ dormant** (ไม่ใช่ flow หลัก แต่เก็บไว้ตามคำขอ "เก็บไว้ก่อน") — assistant message ที่ response มี `session_id` รูปแบบ `v2_...` จะมีปุ่ม "AI Assessment" → `runAIAssessment` POST `{session_id, jd_text, query}` ไป `/vector-rank` → ได้ `job_id` → auto-set `activeJobId`/`jobIdInput` |
| **n8n Agent Manager + sub-agents** (`Q5C8Acw01yeqzlLo`, "New Chat bot - by path", **ACTIVE**, แก้ล่าสุด 2026-06-15) | Agent Manager + MCP Research + Vector Research (HTTP sub-workflow, ทดสอบผ่านแล้ว) + Web Search Researcher (system prompt เขียนครบแล้ว) + Postgres Memory (B) + Parse Output — ครบทุก sub-agent แล้ว แต่ยังไม่ได้ต่อกับ `/ai-search-v3` frontend (ดูแถวด้านล่าง) |
| **JR000230 mechanism — data source confirmed** | `candidate_profile_enhance.skills_list` (Supabase A) มี comma-separated skill tags ตรงกับ criteria แบบ "Visual Merchandising, Window Displays, Logo Design..." — เพียงพอสำหรับ lexical/semantic categorize โดยไม่ต้องใช้ vector |

### 🔴 ยังไม่ทำ / ค้างอยู่

| Component | สถานะ / สิ่งที่ต้องทำ |
|---|---|
| **"4th mechanism" — batch categorize (JR000230-type)** | Design จบแล้ว (ดูหัวข้อด้านล่าง) แต่ยังไม่ build เป็น tool/sub-agent ใน Agent Manager |
| **Figma diagram update** | ยังไม่ใส่ "4th mechanism" (batch categorize) ลงใน diagram |
| **เชื่อม `/ai-search-v3` กับ `Q5C8Acw01yeqzlLo`** | page.tsx ยังเรียก `N8N_WEBHOOK = ".../webhook/ai-search-chat"` (= `4VR7FQMgPflospMd`) — ต้องเปลี่ยนเป็น `.../webhook/0777f5b4-867c-499e-b412-d5daecefefb5` (= `Q5C8Acw01yeqzlLo`) เพื่อให้ Vector Research/Web Search Researcher ที่เพิ่งเขียน prompt เสร็จถูกใช้งานจริง — เป็น manual edit เล็กๆ user จะทำเอง |

### ✅ verify แล้ว (2026-06-16)

| ประเด็น | ผลสรุป |
|---|---|
| Stage 2.5 / 3.5 chat notification (ตาม CLAUDE.md) | เป็นของ **V1 (`/assistant`) เท่านั้น** — `tgfAVlOlLbA8Pdoe` ("AI Assistant v2 stage 3") มี node "Get Top 5 for Chat" → "Build Stage 3.5 Message" → "Send Stage 3.5 Chat" (insert `v2_chat_messages`). V3's Stage3 C (`N6NC8Tp0vg0C5Qk8`) **ไม่มีและไม่ต้องมี** — `Stage3ResultsPanel.tsx` poll `getSearchJobStatus(jobId)` แสดงผลในพาเนลของตัวเองอยู่แล้ว ไม่ผ่าน chat thread |

### ⚠️ ต้องเช็ค/verify (อาจเป็นบั๊กซ่อนอยู่)

| ประเด็น | รายละเอียด |
|---|---|
| Vector rank คุณภาพสำหรับ skill-specific query | `candidate_vectors` source_text = `{position}\|{company}\|{rating}\|{country}\|{dates}` ไม่มี skill detail — เหมาะกับ role-level ranking (เช่น "top 10 GM") แต่ไม่เหมาะกับ skill-level ranking (เช่น "top 10 เก่ง Visual Merchandising") — ยังไม่ทดสอบจริง |

---

## "4th Mechanism" — Batch Categorize (JR000230-type) — Design (ยังไม่ build)

**Use case**: pool ที่รู้ชัด (เช่น JR000230 ~70 คน) × N criteria ที่ user กำหนด custom (ไม่ fix 4 หมวด) → output ตาราง มี/น่าจะมี/ว่าง ต่อคนต่อ criteria → ตอบเป็นแชท (markdown/CSV table, ไม่ใช่ Stage3 form, ไม่มี job_id)

นี่คือ **Path 2 variant** — ไม่กด action button, Agent Manager เลือก tool นี้เมื่อคำถามมีลักษณะ "categorize ทุกคนใน pool ตาม N หมวด"

**Flow**:
```
1. SQL (Supabase A): SELECT candidate_id, name, position, company,
   skills_list, experience_summary
   FROM jr_candidates ... WHERE jr_id = '<jr_id>'   -- ได้ทุกคนใน pool

2. 1 LLM call (batch ทั้งหมด, ไม่ใช่ทีละคน):
   input = compact data ของทุกคน (skills_list สั้น ~200-300 ตัวอักษร/คน
           → 70 คน ≈ 20,000 ตัวอักษร ≈ 5-6k tokens, อยู่ใน context สบายๆ)
         + N criteria ที่ user ระบุ (free-form)
   output = CSV/markdown table:
     rank,name,candidate_id,position,company,<criteria1>,...,<criteriaN>
     ค่าในแต่ละ cell = มี / น่าจะมี / (ว่าง)

3. ตอบกลับเป็น code block ```csv ... ``` ใน chat — user copy ไป Excel ได้
```

**เหตุผลที่ไม่ใช้ vector / ไม่ pre-define keyword set**:
- `candidate_vectors` source_text ไม่มี skill detail (ดูหัวข้อ verify ด้านบน)
- pre-define keyword set ต่อ criteria ใช้ได้กับ 4 หมวดที่ระบุไว้ตายตัว แต่ไม่ generalize กับ N หมวด free-form
- batch LLM call (1 ครั้ง) ถูกกว่า/เร็วกว่า per-candidate read (70 ครั้ง) มาก และ flexible กับ criteria/จำนวนคนเท่าไหร่ก็ได้ (ถ้า pool ใหญ่มาก เช่น 500+ ค่อย chunk เป็นหลาย batch)

**สิ่งที่ต้อง build**:
- Tool/sub-agent ใหม่ใน Agent Manager (`Q5C8Acw01yeqzlLo`) — รับ jr_id (หรือ candidate_id list) + criteria list → SQL (ข้อ 1) → batch LLM (ข้อ 2) → คืน CSV string
- Agent Manager system prompt: เพิ่ม intent detection สำหรับ "categorize pool ตาม custom criteria" → เรียก tool นี้

---

## ลำดับงานที่แนะนำต่อไป

1. **Live-test Path 1 ใหม่ ("AI Analyse" button)** ใน UI จริง — search ด้วย FilterPanel → กรอก AI Criteria → กด "AI Analyse" → เช็คว่า insert `v2_search_results` สำเร็จ, `/vector-rank` คืน `job_id`, และ `Stage3ResultsPanel` โหลดผลถูกต้อง (รอ Stage3 B/C ทำงานตาม schedule 2 นาที)
2. เชื่อม `/ai-search-v3` กับ `Q5C8Acw01yeqzlLo` (เปลี่ยน `N8N_WEBHOOK`) — user ทำเอง
3. Build **"4th mechanism"** (batch categorize) เป็น tool ใหม่
4. อัปเดต Figma diagram ให้ตรงกับ design ล่าสุด

---

## Infrastructure Reference

- **Supabase A** (`ddeqeaicjyrevqdognbn`) — main DB: candidates, `ai_search_jobs`, `ai_search_sessions`, `v2_search_results` (session pool — `{session_id, candidate_id}`, `stage1_included` default=true), `candidate_profile_enhance` (skills_list, experience_summary, about_summary — ใช้สำหรับ batch categorize)
- **Supabase B** (`fkjwftcarqdukkqiogjo`) — vector DB: `candidate_vectors` (768-dim, Vertex `text-embedding-005`), RPC `rank_candidates_by_vector(p_candidate_ids, p_query_vector, p_limit)` — เข้าถึงจาก n8n (`Rank Candidates (B)`) เท่านั้น ไม่มี frontend touchpoint
  - ⚠️ **ไม่สามารถ query ตรงผ่าน Supabase MCP ของ Claude ได้** (permission error, ไม่อยู่ใน `list_projects`) — ต้อง verify ผ่าน n8n หรือให้ user query เอง
- **n8n workflows**:
  - `4VR7FQMgPflospMd` "New Chat bot" — ACTIVE, Stage 1 production
  - `QBFXibNKEWc54uGJ` "Vector Ranking — Stage 2" — ACTIVE, `/vector-rank`
  - `Q5C8Acw01yeqzlLo` "New Chat bot - by path" — **ACTIVE** (confirmed 2026-06-16), webhook `/0777f5b4-867c-499e-b412-d5daecefefb5`, Agent Manager + Path1/2/3 sub-agents ครบ
  - Stage3: `8IBVcjjKvxTNtteE` (A) / `0FQ1takGMELogWRZ` (B) / `N6NC8Tp0vg0C5Qk8` (C)
