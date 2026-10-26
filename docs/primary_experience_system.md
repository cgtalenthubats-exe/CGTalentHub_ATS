# Primary Experience System (`is_primary_current`) — Rules & Change Log

> อ่านก่อนทุกครั้งที่แตะ candidate_experiences ที่ต้องเลือก "ตำแหน่งปัจจุบัน/ล่าสุด" ค่าเดียว
> ระบบ primary มาแทนที่ logic เก่า "latest vs current" ที่แต่ละหน้าเขียนเอง

---

## กติกา (อย่าเปลี่ยนโดยไม่ตั้งใจ)

| Field | ความหมาย |
|---|---|
| `is_current_job` / `end_date` | **ข้อเท็จจริง** — candidate มีงาน Current พร้อมกันได้หลายแถว (board, advisor ฯลฯ) |
| `is_primary_current` | **ตัวแทน** — แถวเดียวต่อ candidate (DB partial unique index) ใช้เมื่อ UI/Report ต้องการค่าเดียว |

- ที่ใดต้องการค่าเดียว (ตาราง, header, PPTX, org chart, ranking) → เรียก `pickPrimaryExperience()` ใน `src/lib/candidate-experience-utils.ts` (primary → current → start_date ล่าสุด) และ `.select()` ต้องมี `is_primary_current`
- Filter ค้นหา "ปัจจุบันอยู่ที่ X" (RPC `search_candidate_ids` ฯลฯ) **ใช้ `is_current_job` ต่อไปโดยเจตนา** — candidate ที่ทำ 2 ที่ควรเจอทั้ง 2 ที่ อย่าเปลี่ยนไปใช้ primary
- Server actions (`src/app/actions/candidate.ts`):
  - `setPrimaryExperience(expId, candId)` — ตั้งแถวนี้เป็น Primary (และ Current), ล้าง primary เดิมก่อน, rollback ถ้าตั้งใหม่ไม่สำเร็จ
  - `markExperiencePast(expId, candId)` — จบงาน, ล้าง primary ของแถวนั้น, เก็บ end_date จริงถ้ามี
  - `setCurrentExperience` — toggle เดิม ตอนนี้ UI ไม่เรียกแล้ว (เก็บไว้ ยังไม่ลบ)

---

## Change Log

### 2026-10-26 — แก้ปุ่ม Primary + ปิดรูรั่ว report (local, ยังไม่ push)

**ปัญหาที่เจอ:** หน้า candidate detail เลือก Primary ไม่ได้ — ปุ่มยังเป็น toggle Current/Past: กด "Concurrent" แล้วกลายเป็น Past, กด "Primary" ก็กลายเป็น Past, error จาก action ถูกเงียบ

**แก้:**
1. `candidate.ts` — เพิ่ม `setPrimaryExperience`, `markExperiencePast`
2. `experience-dialog.tsx` `SetCurrentExperienceButton` — ปุ่มหลักทำหน้าที่ promote เป็น Primary อย่างเดียว (Primary row disable), เพิ่มปุ่ม "End" แยกสำหรับจบงาน, แสดง toast เมื่อ error (props เดิม ไม่ต้องแก้ 4 จุดที่เรียกใช้)
3. `export-placement-report.ts` — เพิ่ม `is_primary_current` ใน select (เดิมขาด ทำให้ sort ตาม primary ไม่ทำงานใน PPTX/Excel ของ placement)
4. `tracking.ts` — เลิกเรียง start_date แบบ text, ใช้ `pickPrimaryExperience()` สำหรับ industry/country ต่อ candidate

5. JR Manage — เพิ่มป้าย "⚠ Pick primary" (สีเหลือง) ใต้คอลัมน์ Current Job เมื่อ candidate มีงาน Current มากกว่า 1 แถวแต่ยังไม่มี `is_primary_current` (`candidate_primary_unset` จาก `jr-candidates.ts`, แสดงใน `candidate-list.tsx`) — ตำแหน่งที่โชว์ในกรณีนี้เป็นแค่ heuristic เดา ให้ recruiter เปิดโปรไฟล์แล้วเลือก Primary

6. `updateExperience` — อุดช่องโหว่: เดิมทุกครั้งที่ save แถวที่ติ๊ก Current จะแย่ง primary (แก้ typo งาน Concurrent แล้ว primary ย้ายเอง) ตอนนี้แย่ง primary เฉพาะตอนเปลี่ยน Past → Current; แถวที่เป็น Current อยู่แล้วคงค่า primary เดิม; แถวที่เปลี่ยนเป็น Past ล้าง primary
   - กติกาที่ยังเหมือนเดิม: `addExperience` ที่เพิ่มงาน Current ใหม่ยังแย่ง primary (ตั้งใจจาก commit เดิม — เหมาะกับย้ายงาน แต่ถ้าเพิ่ม Board seat จะเสียตัวหลัก ยังไม่ได้เปลี่ยน)

7. **Root cause จริงของ "กดไม่ได้":** `setCurrentExperience` เดิมเขียนคอลัมน์ `is_current` ซึ่งไม่มีในตาราง (`candidate_experiences` มีแค่ `is_current_job`, `is_primary_current`) → update ล้มเหลวทุกครั้งและ UI ไม่ตรวจ error จึงเงียบ ลบการเขียน `is_current` ออกจาก action ทั้งหมดแล้ว (อย่าเพิ่มกลับ)
8. `markExperiencePast` (ปุ่ม End) เขียน `end_date` เป็นเดือนปัจจุบันรูปแบบ `M-YYYY` (เช่น `10-2026`) ตามรูปแบบที่ข้อมูลเกือบทั้งหมดใช้ (ไม่มี YYYY-MM-DD) และเก็บ end_date จริงเดิมไว้ถ้ามี

**หมายเหตุ placement report (ข้อ 3):** กับข้อมูลวันนี้ผลลัพธ์ยังไม่เปลี่ยน (ผู้ถูก place 50 คน มีงาน Current >1 แถวแค่ 5 คน และ primary ตรงกับ heuristic ทั้งหมด) เป็นการกันพลาดล่วงหน้าให้ตรงกับ JR Manage / JR report

**ตั้งใจไม่แก้ (ตัดสินใจแล้ว):**
- RPC/view ฝั่ง DB ที่ใช้ `is_current_job` (search, summary, cascading, jr_report ฯลฯ) — พฤติกรรม concurrent ถูกต้องอยู่แล้ว
- logic เรียงซ้ำในหน้า candidates list / table-view / AgingCandidateTable / dashboard recruiter — ผลตรงกับ util อยู่ จึงเก็บ refactor ไว้ทีหลัง

**ค้างอยู่ (ต้องตัดสินใจ/ตรวจก่อนแก้ข้อมูล — ยังไม่ได้แตะ DB):**
- (เจ้าของตัดสินใจ 2026-10-26: ปล่อยไว้ก่อน ยังไม่แก้ข้อมูล DB ด้านล่างนี้)
- 56 แถวเป็น primary แต่ `is_current_job` ไม่ใช่ Current (54 แถวในนั้น `end_date='Present'` → น่าจะ is_current_job เก่า ไม่ตรงกับ end_date; ต้องดูทีละเคสว่าอันไหนถูก)
- 146 แถว `is_current_job<>'Current'` แต่ `end_date='Present'`
- 94 candidate มีงาน Current แต่ไม่มี primary (read fallback ใช้ heuristic อยู่ จึงไม่พัง)
- view `vw_candidate_group_distribution` / `vw_candidate_industry_distribution` — ตรวจว่านับ candidate ซ้ำเมื่อมี concurrent หรือไม่

---

*Last updated: 2026-10-26*
