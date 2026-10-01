# Pitch Narrative — ปัญหาของงาน Recruitment → AI & Automation Solution

> ใช้คู่กับ `docs/PROJECT_OVERVIEW_FOR_PITCH.md` (รายละเอียดฟีเจอร์และไฟล์อ้างอิง)
> หมายเหตุ: ปัญหาเป็นบริบททั่วไปของวงการ recruitment/headhunting ไม่ใช่สถิติที่วัดจากระบบนี้
> ถ้าจะใส่ตัวเลข (เวลาที่เสีย, % ที่ประหยัด) ให้ใส่ placeholder [ใส่ตัวเลข] แล้ววัดเพิ่ม

## โครงเรื่อง (Story Arc)

**ปัญหา 7 ข้อ → แต่ละข้อมี Solution ที่ระบบทำอยู่จริง → สรุปด้วยภาพรวม "AI ทำ คนตัดสินใจ"**

รูปแบบสไลด์ทุกคู่: ซ้าย = ปัญหา (ภาพ/ประโยคสั้นที่คนฟังพยักหน้า) · ขวา = Solution + ฟีเจอร์ที่ทำแล้ว

---

## ปัญหา 1 — ข้อมูลผู้สมัครกระจัดกระจาย คีย์มือ ซ้ำซ้อน
**ที่เจอ:** Resume หลายรูปแบบ (PDF, LinkedIn, Word) ต้องนั่งคีย์เข้าระบบ, คนเดิมถูกสร้างซ้ำ, รูปแบบข้อมูลไม่เหมือนกัน

**Solution: Document Parsing & Ingestion**
- อัปโหลด resume เข้าคิว → n8n parse → ได้โปรไฟล์โครงสร้างกลับมา
- วางข้อความดิบ (CV/LinkedIn) → AI แปลงเป็น structured profile (prompt แก้ได้จากหน้า Settings)
- CSV bulk import พร้อม import log
- ตรวจ duplicate (ชื่อ/อีเมล/LinkedIn) ก่อนสร้างคนใหม่

## ปัญหา 2 — ข้อมูลสกปรก ค้นหาแล้วพลาดคนเก่ง
**ที่เจอ:** ชื่อบริษัทเขียนไม่เหมือนกัน ("Marriott Sukhumvit" vs "Marriott International"), ตำแหน่งไม่ standard, ประเทศเดาจากสำนักงานใหญ่ → filter ไม่แม่น คนที่ใช่หลุดผลลัพธ์

**Solution: Data Infrastructure (Data Moat)**
- Company master + variation: ชื่อบริษัทหลายแบบ → `company_id` เดียว
- Hotel chain system: 92 chains / 399 sub-brands พร้อม star rating
- Controlled vocabulary ของตำแหน่ง/industry/ภูมิภาค
- Location trust model: แยก "ประเทศที่ทำงาน" กับ "ที่อยู่ปัจจุบัน" และไม่เอาประเทศที่ AI เดามาปนใน filter
- เครื่องมือตรวจคุณภาพข้อมูล (Data Aging report, ระบบเติม keyword อัตโนมัติ)

## ปัญหา 3 — ค้นหา candidate ช้า ต้องรู้ว่าจะค้นอย่างไร
**ที่เจอ:** Boolean search/filter ซับซ้อน, recruiter แต่ละคนค้นไม่เหมือนกัน, โจทย์จากลูกค้าเป็นภาษาธรรมชาติ ("GM โรงแรม 5 ดาว เคยอยู่ Marriott")

**Solution: AI Search**
- พิมพ์ภาษาไทย/อังกฤษ → AI แปลงเป็น filter ให้อัตโนมัติ + แนะนำเงื่อนไขที่ควรขยาย (chips)
- Filter 11+ แกนที่ส่งผลถึงกันแบบ cascading
- Chat agent ตอบคำถามเชิงวิเคราะห์ ("แต่ละ chain มีกี่คน")
- ผู้ใช้ปรับ filter ต่อเองได้ ไม่ต้อง prompt ซ้ำ

## ปัญหา 4 — คัดกรอง shortlist กินเวลา และ AI ทั่วไปแพง
**ที่เจอ:** ได้ pool หลักร้อยหลักพัน ต้องเปิดอ่านทีละโปรไฟล์ ใช้ LLM อ่านทุกคนก็แพงและช้า

**Solution: Funnel 3 ชั้น + AI Assessment**
- SQL (หลักร้อย–พัน) → Vector ranking (Top 20) → LLM ประเมินเฉพาะ 20 คนนั้น = คุม cost
- คะแนนรวม 100 จาก 4 มิติ (Experience / Leadership / Market / Skills) อย่างละ 25
- มี strengths / gaps / trade-off รายคน + สรุปเทียบกันทั้งกลุ่มและ final recommendation
- เห็นผลทีละคนแบบ real-time ระหว่างที่ AI ทำงาน

## ปัญหา 5 — Pipeline หลาย JR หลายสถานะ งานตกหล่น ไม่มีใครไล่
**ที่เจอ:** Excel/อีเมลกระจาย ไม่รู้ใครค้างอยู่ stage ไหนนานเกินไป สถานะไม่ตรงกัน ไม่มีหลักฐานย้อนหลัง

**Solution: Pipeline Automation**
- JR lifecycle ครบ: Pool → Longlist/Top Profile → Interview → Offer → Placement/Resignation + Kanban
- Validation อัตโนมัติ: บล็อก blacklist, ข้ามคนซ้ำใน JR
- Stage Aging + Pending Tasks: ระบบแจ้งว่าใครค้างนานเกินไป และ stage นั้นใครเป็นเจ้าของ
- Audit trail ทุกการเปลี่ยนสถานะ (`status_log`)
- Dashboard KPI, funnel, recruiter performance

## ปัญหา 6 — ทำเอกสารส่งลูกค้าซ้ำๆ ทุกโปรเจค
**ที่เจอ:** ต้องก๊อปโปรไฟล์ลงสไลด์ทีละคน จัด layout, ทำ JD เป็น PDF, ส่งอีเมล — เสียเวลาหลายชั่วโมงต่อ JR

**Solution: Document Preparation พร้อม Human Review**
- สร้าง PPTX อัตโนมัติ: Short Profile (6 คน/สไลด์), Longlist, AI Assessment report
- JD → PDF, Org chart → PPTX
- ส่งอีเมลพร้อมไฟล์แนบผ่าน Gmail ในคลิกเดียว
- คนแค่ตรวจ → แก้ถ้าจำเป็น → ส่ง
- Salary Benchmark ต่อ JR เทียบ budget กับเงินเดือนที่เคยจ่ายจริง

## ปัญหา 7 — ไม่รู้ว่าใครอยู่ตรงไหนในองค์กรคู่แข่ง
**ที่เจอ:** ผังองค์กรเป็นรูปภาพ/PDF จัดทำใหม่ทุกครั้ง ไม่ผูกกับฐานผู้สมัคร

**Solution: Org Chart Intelligence**
- อัปโหลดรูป/PDF ผังองค์กร → AI Vision แปลงเป็นโครงสร้าง (ชื่อ/ตำแหน่ง/หัวหน้า)
- ผูก node กับ candidate ในระบบ, แก้ไข/โคลนได้, ส่งออก PPTX
- ใช้ทำ talent mapping ได้ทันที

---

## สไลด์สรุป (Closing)

**"ปัญหาเดิม: คนทำงานซ้ำ → ระบบใหม่: AI ทำงานซ้ำ คนตัดสินใจ"**

| ขั้นตอน | เดิม (คนทำ) | ระบบนี้ (AI ทำ) | คนทำอะไร |
|---|---|---|---|
| รับข้อมูล | คีย์มือ | Parse อัตโนมัติ | ตรวจความถูกต้อง |
| ค้นหา | Boolean/filter เอง | NL → filter | ปรับ/อนุมัติ |
| คัดกรอง | อ่านทีละคน | Vector + AI scoring | เลือก shortlist |
| ติดตาม | Excel/อีเมล | Pipeline + แจ้งงานค้าง | ตัดสินใจ/คุยลูกค้า |
| เอกสาร | ทำสไลด์เอง | สร้าง PPTX/PDF + ส่งอีเมล | รีวิวก่อนส่ง |

## แนะนำการเล่าเรื่อง
- เปิดด้วยสถานการณ์จริง 1 สไลด์ ("ลูกค้าส่ง JD มาตอนเช้า ต้องส่ง shortlist ก่อนเที่ยงวันพรุ่งนี้") แล้วเดินตามขั้นตอนที่ระบบช่วย
- แต่ละคู่ปัญหา/solution ใช้ screenshot หน้าจอจริง 1 ภาพ (route อยู่ใน PROJECT_OVERVIEW ข้อ 7)
- ปิดด้วยข้อจำกัดที่ตรงไปตรงมา (ดูข้อ 5 ใน PROJECT_OVERVIEW) จะช่วยให้น่าเชื่อถือขึ้น
- ถ้าเสนอโปรเจคนอกวงการ recruitment ให้เปลี่ยน "ปัญหา" เป็นภาษาของลูกค้า แต่ใช้ solution pattern เดิม (ตารางข้อ 9 ใน PROJECT_OVERVIEW)
