# CG Talent Hub ATS — ร่างรายงานค่าใช้จ่ายรายเดือน (ไม่รวม MA)

> สถานะ: **ร่าง** จัดทำ 2026-11-05 จากโค้ดใน repo + ข้อมูลที่เจ้าของระบบให้ + ผล web search
> ตัวเลขราคาทุกตัวต้องยืนยันกับหน้า pricing / ใบแจ้งหนี้จริงก่อนส่งผู้ใช้ — สถานะของแต่ละบรรทัดระบุไว้ในคอลัมน์ "สถานะ"
> GitHub: https://github.com/cgtalenthubats-exe/CGTalentHub_ATS

---

## 1. สรุปสำหรับผู้บริหาร

- ค่าใช้จ่ายแบ่ง 2 ส่วน: **ค่าคงที่รายเดือน** (โครงสร้างพื้นฐาน) และ **เครดิต AI** (เติมแบบ Prepaid)
- ค่า AI ผันแปรตามปริมาณงาน ประเมินล่วงหน้าตาม usage จริงทำได้ยาก จึงเสนอเป็น **งบเครดิตรายเดือนที่ต้องมีในบัญชี** บน **Gemini Tier 2** แทนการตีราคาต่อการใช้งาน
- ปรับโครงสร้างแล้ว: **ตัด Perplexity** และ **บริการ Google Cloud ของ AppSheet** (ระบบเก่า ที่คิดตามจำนวนผู้ใช้) ออก ต้นทุนจึงลดลง

---

## 2. ค่าคงที่รายเดือน

| รายการ | ใช้ทำอะไร | ตัวเลขที่ให้มา | ผลตรวจ | สถานะ |
|---|---|---|---|---|
| Supabase Pro | ฐานข้อมูลหลัก (Postgres, Auth, Storage, RPC, vector) | $25 | $25 ต่อ organization ตรงกับแหล่งข้อมูล (รวม compute 1 project) | ✅ รวมเป็น **project เดียว** แล้ว (เดิมแยก Supabase B สำหรับ vector เพราะกลัว DB เต็ม ตอนนี้พื้นที่เหลือเฟือ จึงไม่มีค่า project เพิ่ม) |
| n8n บน Hostinger VPS | workflow AI/automation ทั้งหมด | $15 | KVM 2 โปรโมชั่น ~$8.8–9, **ต่ออายุ ~$15**, add-on backup รายวัน $2.99 | ✅ สอดคล้องกับราคาต่ออายุ (ไม่รวม backup add-on ถ้ามี) |
| Apify | (ตามที่ระบุ) | $29 | Starter $29 ($26 รายปี) ตรงกับแหล่งข้อมูล | ✅ ยืนยันจากเจ้าของระบบ |
| Vercel | โฮสต์ Next.js (ดูข้อ 4) | — | Pro **$20/เดือน** ต่อ deploying seat รวมเครดิตใช้งาน $20 | ❓ ยังไม่ทราบแผนปัจจุบัน |
| Domain name (ชื่อโดเมน) | ชื่อเว็บของระบบ | — | ยังไม่รวมในตัวเลข | **[ใส่ตัวเลข ต่อปี ÷ 12]** |
| Gmail API | ส่งรายงานทางอีเมล | — | ไม่เห็นค่าใช้จ่ายใน repo | ไม่รวม |

**ผลรวมค่าคงที่ (ประมาณ):**
- Supabase 25 + n8n 15 + Apify 29 = **$69**
- ถ้าใช้ Vercel Pro 1 seat: **+$20 → ~$89**
- บวกค่า domain (ต่อปี ÷ 12) ที่ยังไม่รวม

(ยังไม่รวม VAT และค่าธรรมเนียมบัตร)

---

## 3. AI LLM API

### 3.1 ใช้ตรงไหนบ้าง (จากโค้ด + docs)

| งาน | โมเดลที่เห็น | ที่รัน | ผู้ให้บริการ |
|---|---|---|---|
| แปลงคำค้นภาษาธรรมชาติเป็น filter (`/ai-search-demo`) | Claude Haiku 4.5 | Next.js | Anthropic |
| `/assistant` (agent ค้นหาแบบ tool-use) | Gemini 2.5 Flash (ค่าเริ่มต้น) | Next.js | Google |
| AI Search V3 chat (เลือกโมเดลได้ในหน้า) | Gemini 2.5 Flash / 2.5 Flash-Lite / 3.1 Flash-Lite | n8n | Google |
| Parse ข้อความ CV เป็นโปรไฟล์ | Gemini 3.1 Flash-Lite (ตั้งค่าได้) | Next.js | Google |
| Parse รูป/PDF ผังองค์กร (Vision) | Gemini (ค่าตั้งใน `ai_model_name`) | Next.js | Google |
| Parse resume หลายไฟล์ | Gemini (ตามที่เจ้าของระบบระบุ) | n8n | Google |
| ประเมิน candidate รายคน (Stage 3) | Gemini | n8n | Google |
| สรุปและจัดอันดับ (Stage 3) | Claude Sonnet (ตาม docs) | n8n | Anthropic |
| Vector embedding (Stage 2) | `text-embedding-005` | n8n | Google (Vertex) |
| JR AI chat | โมเดลตามที่ตั้งใน n8n | n8n | — |
| **จัดหมวด Job Function ของ candidate** | ตั้งต้นฝั่ง n8n (ไม่เห็นใน repo) | n8n | ตามที่ตั้ง |
| จัดหมวด Industry / Position keyword (batch) | AI ผ่าน n8n (`n8n_ai_batch_prompts.md`) | n8n | ตามที่ตั้ง |

หมายเหตุ:
- ไม่พบการเรียก OpenAI ใน repo (ฝั่ง n8n ตรวจไม่ได้) หากมีการใช้ ให้ระบุว่าใช้งานใด
- Job Function: ใน repo มีเพียง constants การจัดกลุ่มและฟิลด์ในโปรไฟล์ ส่วนที่ให้ AI จัดหมวดอยู่ฝั่ง n8n ต้องให้เจ้าของ workflow ยืนยันว่าโมเดลไหน
- โมเดลที่ตั้งได้จากหน้า Settings / `/admin/n8n` เปลี่ยนได้โดยไม่ต้อง deploy

### 3.2 วิธีชำระเงิน (ตามข้อมูลที่ตรวจ)

| | Gemini | Anthropic | OpenAI |
|---|---|---|---|
| รูปแบบ | Prepaid (เติมเครดิต) | Prepaid (เติมเครดิต) | Prepaid (เติมเครดิต) |
| ซื้อขั้นต่ำ | $10 (ถือได้สูงสุด $5,000) | ไม่พบตัวเลข ดูที่ Console | $5 (ค่าเริ่มต้น $10) |
| ต้องจ่ายต่อเนื่อง | ไม่ ใช้จนหมด | ไม่ | ไม่ |
| Auto-reload | มี เป็นตัวเลือก + เพดานเติมต่อเดือน | มี | มี |
| เครดิตหมดอายุ | 12 เดือน ไม่คืนเงิน | 1 ปี ไม่คืนเงิน | ~1 ปี (แหล่งรอง) |
| เครดิตหมด | บริการหยุด | API หยุด | หยุด |
| Tier / เพดาน | Tier 2: จ่ายสะสม $100 + 3 วัน, เพดาน $2,000/เดือน | Start $500, Build $1,000, Scale $200,000 ต่อเดือน (จัดตามประวัติการใช้) | Tier 2: $50 + 7 วัน, $500/เดือน (แหล่งรอง) |

### 3.3 ทำไมเสนอ Gemini Tier 2

**ข้อเท็จจริงที่ต้องสื่อให้ถูก:** Tier **ไม่ใช่ค่าบริการรายเดือน** ไม่มีค่า tier แยก ค่าใช้จ่ายคือ token ที่ใช้จริง ส่วน tier กำหนดเพดานอัตราการใช้ (TPM) และเพดานใช้จ่ายต่อเดือน ดังนั้น "ค่าใช้จ่ายรายเดือน" ของ AI = **เครดิตที่ต้องมีในบัญชีเพื่อให้ใช้งานต่อเนื่อง**

**เหตุผลเลือก Tier 2 (ข้อสรุปจากประสบการณ์ใช้งานของเจ้าของระบบ):**
- Tier 2 รองรับปริมาณ candidate ที่เพิ่มขึ้นต่อเดือนและการใช้งานใน JR ต่างๆ ได้เพียงพอ ยังไม่ต้องเพิ่มไปกว่านี้
- ถ้ากลับไป Tier 1 เพื่อลดค่าใช้จ่าย จะต้อง:
  - ซอยงานให้เล็กลง และเพิ่มจำนวนรอบการทำงาน
  - เสี่ยงปริมาณงานเกินเพดานจนระบบล่มโดยไม่รู้ตัว
  - ต้นทุนรวมอาจไม่ต่างจาก Tier 2 มากนัก เพราะค่า token เท่าเดิมและมีรอบ retry เพิ่ม

> ข้อควรระวัง: ข้อสรุปข้างต้นเป็นการประเมินเชิงปฏิบัติการ ยังไม่ได้ตรวจกับตัวเลข TPM ของ Tier 1/2 ในหน้าทางการของ Google (หน้าถูกบล็อกตอนจัดทำ) ควรแนบตัวเลข TPM จริงจาก AI Studio เป็นหลักฐาน

### 3.4 งบเครดิตรายเดือนที่เสนอ

| รายการ | จำนวน |
|---|---|
| Gemini + Vertex embedding (ส่วนใหญ่ของงาน AI) | **[ใส่ตัวเลข]** |
| Anthropic (Haiku แปลง filter + Sonnet สรุป Stage 3) | **[ใส่ตัวเลข]** |
| OpenAI (ถ้ามีการใช้) | **[ใส่ตัวเลข]** |
| Buffer เผื่อ retry / ปริมาณพุ่ง | **[ใส่ %]** |

วิธีหาตัวเลข: ใช้ยอดใช้จริงเฉลี่ย 3 เดือนล่าสุดจากหน้า usage/billing ของแต่ละเจ้า แล้วบวก buffer ตั้ง auto-reload พร้อมเพดานต่อเดือนและ alert ยอดคงเหลือ เพื่อไม่ให้เครดิตหมดกลางวันทำงาน

### 3.5 สิ่งที่ตัดออกแล้ว (ระบบเก่า)
- **Perplexity** — ใช้ใน flow เก่าของหน้า `/ai-search` (agent ค้นบริษัท/ข่าว) ปัจจุบันตัดออกแล้ว (ใน `StatusPipeline.tsx` ยังมีข้อความ label เก่าอยู่ เป็นเรื่อง UI ไม่มีค่าใช้จ่าย)
- **บริการ Google Cloud ที่ใช้กับ AppSheet** — AppSheet ของระบบเก่าคิดค่าบริการตามจำนวนผู้ใช้งาน ปัจจุบันตัดออกแล้ว เมื่อมาใช้ระบบนี้ ต้นทุนลดลงและไม่ผูกกับจำนวนผู้ใช้
- **Vertex AI embedding** (`text-embedding-005`) ถือเป็นส่วนหนึ่งของค่า LLM ฝั่ง Google จึงรวมอยู่ในงบเครดิต AI ข้อ 3.4 ไม่ได้แยกเป็นบริการ Google Cloud ต่างหาก

---

## 4. Vercel — จำเป็นต้องใช้แผน Pro ไหม

**คำถามที่ถูกต้องคือ:** ถ้าโฮสต์เว็บแอปบน Vercel ต่อ และเก็บเงินจากผู้ใช้ ต้องใช้แผน Pro หรือไม่

**สิ่งที่ตรวจพบ**
- มี project `cg-talent-hub-ats` บน Vercel ผูกกับ repo นี้ และ docs ระบุว่าใช้ Vercel Preview ของ branch ทดสอบ
- ผมอ่านแผนปัจจุบัน (Hobby/Pro) ไม่ได้ เพราะ scope ต้องให้เจ้าของอนุมัติสิทธิ์ก่อน

**ข้อสรุป: เป็นเรื่องเงื่อนไขการใช้งาน ไม่ใช่เรื่องฟีเจอร์ — ถ้าเก็บเงินผู้ใช้ ควรใช้ Pro**
- เอกสารทางการของ Vercel ระบุว่า Hobby จำกัดสำหรับการใช้ส่วนบุคคลที่ไม่เชิงพาณิชย์ และการใช้งานเชิงพาณิชย์ต้องใช้ Pro หรือ Enterprise การเก็บเงินค่าใช้ระบบจากผู้ใช้เข้าข่ายเชิงพาณิชย์ ไม่ใช่แค่ "มีก็ดี"
- ความเสี่ยงของการอยู่ Hobby คือผิดเงื่อนไขการใช้งานและ project อาจถูกระงับ (ข้อหลังมาจากแหล่งรอง) นิยามตรงของคำว่า "เชิงพาณิชย์" ควรอ่านจากหน้า Fair Use ของ Vercel เองก่อนสรุปกับลูกค้า
- ฝั่งเทคนิค ตอนนี้ Pro ยังไม่ได้ให้ความสามารถที่ระบบใช้เพิ่ม: เวลารัน function ค่าเริ่มต้นคือ 300 วินาทีทั้ง Hobby และ Pro และโค้ดยังไม่ได้ตั้ง `maxDuration` เพดานที่ต่างกันคือ Hobby 300 วินาที vs Pro 800 วินาที เป็นประโยชน์เมื่อมีงาน export หนักที่เกิน 5 นาที

**ค่าใช้จ่าย:** Pro $20/เดือน ต่อ deploying seat (รวมเครดิตใช้งาน $20) ผู้ดูอย่างเดียว (viewer) ไม่คิดเงินตามแหล่งข้อมูลบุคคลที่สาม
**ทางเลือก:** ย้ายไปโฮสต์บน VPS เดิมเพื่อเลี่ยง $20 แต่ต้องดูแลเอง (deploy, SSL, restart) และเสีย preview ต่อ branch

---

## 5. รายการที่ต้องยืนยันก่อนส่งรายงาน

ยืนยันแล้ว: Apify $29, Supabase เหลือ project เดียว, Google Cloud ที่ตัดคือ AppSheet, Vertex embedding นับรวมใน LLM

ยังต้องยืนยัน:
1. แผน Vercel ปัจจุบัน (Hobby/Pro) และจำนวน seat
2. ราคา domain และรอบต่ออายุ (ต่อปี) รวมค่า DNS/อีเมลถ้ามี
3. มีการใช้ OpenAI จริงหรือไม่ และใช้ในงานใด
4. โมเดลที่ใช้จัดหมวด Job Function ใน n8n
5. ตัวเลข TPM ของ Gemini Tier 1 เทียบ Tier 2 จาก AI Studio
6. ยอดใช้จริง 3 เดือนล่าสุดของ Gemini / Anthropic / OpenAI เพื่อกรอกงบข้อ 3.4
7. Backup add-on ของ VPS ($2.99) มีหรือไม่
8. หลังรวม Supabase เหลือ project เดียว: workflow n8n ที่เคยชี้ไป Supabase B (vector rank) ต้องปรับให้ชี้ไป project หลัก

---

## 6. แหล่งอ้างอิงราคา (ตรวจเมื่อ 2026-11-05)

- Anthropic rate limits / spend limits (หน้าทางการ): https://platform.claude.com/docs/en/api/rate-limits
- Anthropic credits / auto-reload: https://support.claude.com/en/articles/8977456-how-do-i-pay-for-my-api-usage
- Gemini API billing: https://ai.google.dev/gemini-api/docs/billing
- OpenAI prepaid billing: https://help.openai.com/en/articles/9047769
- Vercel Pro plan: https://vercel.com/docs/plans/pro-plan
- Vercel Hobby plan / Fair use guidelines: https://vercel.com/docs/limits/fair-use-guidelines
- Vercel Functions limitations: https://vercel.com/docs/functions/limitations
- Supabase (database-only cost FAQ): https://supabase.com/kb/faqs/platform/database-only-cost
- Hostinger self-hosted n8n: https://www.hostinger.com/self-hosted-n8n
- Apify pricing (ตัวเลขจากบุคคลที่สาม ต้องยืนยันที่ apify.com/pricing): https://automationatlas.io/answers/apify-pricing-explained-2026/
