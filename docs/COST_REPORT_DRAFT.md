# CG Talent Hub ATS — ร่างรายงานค่าใช้จ่ายรายเดือน (ไม่รวม MA)

> สถานะ: **ร่าง** จัดทำ 2026-11-05 จากโค้ดใน repo + ข้อมูลที่เจ้าของระบบให้ + ผล web search
> ตัวเลขราคาทุกตัวต้องยืนยันกับหน้า pricing / ใบแจ้งหนี้จริงก่อนส่งผู้ใช้ — สถานะของแต่ละบรรทัดระบุไว้ในคอลัมน์ "สถานะ"
> GitHub: https://github.com/cgtalenthubats-exe/CGTalentHub_ATS

---

## 1. สรุปสำหรับผู้บริหาร

- ค่าใช้จ่ายแบ่ง 2 ส่วน: **ค่าคงที่รายเดือน** (โครงสร้างพื้นฐาน) และ **เครดิต AI** (เติมแบบ Prepaid)
- ค่า AI ผันแปรตามปริมาณงาน ประเมินล่วงหน้าตาม usage จริงทำได้ยาก จึงเสนอเป็น **งบเครดิตรายเดือนที่ต้องมีในบัญชี** บน **Gemini Tier 2** แทนการตีราคาต่อการใช้งาน
- ปรับโครงสร้างแล้ว: **ตัด Perplexity** และ **บริการ Google Cloud Business** ซึ่งเป็นส่วนของระบบเก่าออก ต้นทุนจึงลดลง

---

## 2. ค่าคงที่รายเดือน

| รายการ | ใช้ทำอะไร | ตัวเลขที่ให้มา | ผลตรวจ | สถานะ |
|---|---|---|---|---|
| Supabase Pro | ฐานข้อมูลหลัก (Postgres, Auth, Storage, RPC) | $25 | $25 ต่อ organization ตรงกับแหล่งข้อมูล แต่รวม compute เฉพาะ 1 project (เครดิต $10 ครอบ Micro); project เพิ่มโดยประมาณ $10/เดือน | ⚠️ ตรวจว่า **Supabase B** (project เวกเตอร์ แยกจากหลัก ตาม `ai-search-v3-plan.md`) อยู่ org เดียวกันหรือไม่ ถ้าใช่อาจมี ~+$10 |
| n8n บน Hostinger VPS | workflow AI/automation ทั้งหมด | $15 | KVM 2 โปรโมชั่น ~$8.8–9, **ต่ออายุ ~$15**, add-on backup รายวัน $2.99 | ✅ สอดคล้องกับราคาต่ออายุ (ไม่รวม backup add-on ถ้ามี) |
| Apify | (ตามที่ระบุ) | $39 | แหล่งข้อมูลส่วนใหญ่ระบุ Starter **$29** ($26 รายปี) และ Scale $199; ไม่พบแหล่งที่ระบุ $39 | ❌ **ไม่ตรง** ตรวจใบแจ้งหนี้จริง อาจเป็นแผนเก่า หรือ $29 + ค่าใช้เกิน |
| Vercel | โฮสต์ Next.js (ดูข้อ 4) | — | Pro **$20/เดือน** ต่อ deploying seat รวมเครดิตใช้งาน $20 | ❓ ยังไม่ทราบแผนปัจจุบัน |
| Gmail API | ส่งรายงานทางอีเมล | — | ไม่เห็นค่าใช้จ่ายใน repo | ไม่รวม |

**ผลรวมค่าคงที่ (ประมาณ):**
- ตามตัวเลขที่ให้มา: 25 + 15 + 39 = **$79**
- ถ้า Vercel Pro 1 seat: **+$20 → ~$99**
- ถ้า Supabase B คิดเงินแยก: **+~$10**
- ถ้า Apify จริงคือ $29: **−$10**

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
| Gemini (ส่วนใหญ่ของงาน AI) | **[ใส่ตัวเลข]** |
| Anthropic (Haiku แปลง filter + Sonnet สรุป Stage 3) | **[ใส่ตัวเลข]** |
| OpenAI (ถ้ามีการใช้) | **[ใส่ตัวเลข]** |
| Buffer เผื่อ retry / ปริมาณพุ่ง | **[ใส่ %]** |

วิธีหาตัวเลข: ใช้ยอดใช้จริงเฉลี่ย 3 เดือนล่าสุดจากหน้า usage/billing ของแต่ละเจ้า แล้วบวก buffer ตั้ง auto-reload พร้อมเพดานต่อเดือนและ alert ยอดคงเหลือ เพื่อไม่ให้เครดิตหมดกลางวันทำงาน

### 3.5 สิ่งที่ตัดออกแล้ว (ระบบเก่า)
- **Perplexity** — ใช้ใน flow เก่าของหน้า `/ai-search` (agent ค้นบริษัท/ข่าว) ปัจจุบันตัดออกแล้ว (ใน `StatusPipeline.tsx` ยังมีข้อความ label เก่าอยู่ เป็นเรื่อง UI ไม่มีค่าใช้จ่าย)
- **บริการ Google Cloud Business** — ตัดออกเพราะเป็นของระบบเก่า ต้นทุนลดลง
- ⚠️ ตรวจให้แน่ใจว่า **embedding `text-embedding-005` ยังเรียกผ่าน Vertex AI หรือย้ายไป Gemini API แล้ว** เพราะ Vertex ผูกกับบิล Google Cloud ถ้ายังใช้อยู่ จะมีค่าใช้จ่ายส่วนนี้แยกจากเครดิต Gemini

---

## 4. Vercel จำเป็นไหม

**สิ่งที่ตรวจพบ**
- มี project `cg-talent-hub-ats` บน Vercel ผูกกับ repo นี้ และ docs ระบุว่าใช้ Vercel Preview ของ branch ทดสอบ
- แอปมีโค้ดที่พึ่ง serverless (`outputFileTracingIncludes` ใน `next.config.ts`) และไม่ได้ตั้ง `maxDuration` ให้ function ใดเลย
- ผมอ่านแผน (Hobby/Pro) และการใช้งานจริงไม่ได้ เพราะ scope ต้องให้เจ้าของอนุมัติสิทธิ์ก่อน

**ข้อสรุป**
- Vercel ทำหน้าที่โฮสต์เว็บแอป ถ้าไม่ใช้ ต้องย้ายไปโฮสต์ที่อื่น (เช่น VPS เดิม) ซึ่งได้ประหยัด ~$20 แต่ต้องดูแลเอง: deploy, SSL, restart, ไม่มี preview ต่อ branch และต้องปรับให้รันนอก serverless
- ถ้าแผนปัจจุบันเป็น Hobby: Hobby ออกแบบสำหรับการใช้ส่วนตัว/ไม่เชิงพาณิชย์ เมื่อเก็บเงินผู้ใช้ น่าจะต้องใช้ Pro (ยืนยันกับเงื่อนไขของ Vercel ก่อน)
- งานที่หนัก (สร้าง PPTX, export) อาจชนเพดานเวลา function ของแผน ต้องเช็คหน้า Functions ของ Vercel

**ทางเลือกที่ต้องตัดสินใจ:** อยู่ Vercel Pro ($20) หรือย้ายไป VPS ($0 เพิ่ม แต่เพิ่มภาระดูแล)

---

## 5. รายการที่ต้องยืนยันก่อนส่งรายงาน

1. Apify จ่ายจริงเท่าไร (ตัวเลข $39 ไม่ตรงกับราคาที่พบ)
2. Supabase B อยู่ org เดียวกันหรือไม่ และคิดเงินอย่างไร
3. แผน Vercel ปัจจุบัน (Hobby/Pro) และจำนวน seat
4. Embedding ยังอยู่บน Vertex AI หรือไม่
5. มีการใช้ OpenAI จริงหรือไม่ และใช้ในงานใด
6. โมเดลที่ใช้จัดหมวด Job Function ใน n8n
7. ตัวเลข TPM ของ Gemini Tier 1 เทียบ Tier 2 จาก AI Studio
8. ยอดใช้จริง 3 เดือนล่าสุดของ Gemini / Anthropic / OpenAI เพื่อกรอกงบข้อ 3.4
9. Backup add-on ของ VPS ($2.99) มีหรือไม่

---

## 6. แหล่งอ้างอิงราคา (ตรวจเมื่อ 2026-11-05)

- Anthropic rate limits / spend limits (หน้าทางการ): https://platform.claude.com/docs/en/api/rate-limits
- Anthropic credits / auto-reload: https://support.claude.com/en/articles/8977456-how-do-i-pay-for-my-api-usage
- Gemini API billing: https://ai.google.dev/gemini-api/docs/billing
- OpenAI prepaid billing: https://help.openai.com/en/articles/9047769
- Vercel Pro plan: https://vercel.com/docs/plans/pro-plan
- Supabase (database-only cost FAQ): https://supabase.com/kb/faqs/platform/database-only-cost
- Hostinger self-hosted n8n: https://www.hostinger.com/self-hosted-n8n
- Apify pricing (ตัวเลขจากบุคคลที่สาม ต้องยืนยันที่ apify.com/pricing): https://automationatlas.io/answers/apify-pricing-explained-2026/
