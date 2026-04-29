# Industry Vocabulary

> **สร้างครั้งแรก:** April 2026  
> **ข้อมูลอ้างอิง:** distinct values จาก `company_master.industry` และ `company_master.group`  
> **วัตถุประสงค์:** เป็น controlled vocabulary สำหรับ AI Agent ให้แปลง industry ที่ user พูดเป็น SQL filter ที่ถูกต้อง

---

## โครงสร้าง 2 ระดับ

| Column | ลักษณะ | ใช้เมื่อ |
|--------|--------|---------|
| `group` | Bucket กว้าง 6 ค่า | filter หลัก — ครอบคลุมสูง ไม่พลาด |
| `industry` | ละเอียด 60+ ค่า | filter เพิ่มเติม — ถ้า user ระบุ sector ชัด |

**หลักการ:** ใช้ `group` เป็นตัวหลักเสมอ เพิ่ม `industry` เมื่อต้องการแม่นขึ้น

---

## Vocab Map

### 🏨 Hospitality & โรงแรม

| User พูดว่า | group | industry |
|-------------|-------|----------|
| โรงแรม, Hotel, Hospitality, Resort | `'Hospitality & Real Estate'` | `'Hospitality'` |
| โรงแรม 5 ดาว, Luxury Hotel | `'Hospitality & Real Estate'` | `'Hospitality'` |
| Tourism, Travel | `'Hospitality & Real Estate'` | `'Hospitality'` |

**SQL แนะนำ:**
```sql
cm."group" = 'Hospitality & Real Estate' AND cm.industry = 'Hospitality'
```

---

### 🏢 Real Estate & อสังหาริมทรัพย์

| User พูดว่า | group | industry |
|-------------|-------|----------|
| อสังหา, Real Estate, Property | `'Hospitality & Real Estate'` | `'Real Estate'` |
| Developer, Construction | `'Hospitality & Real Estate'` | `'Real Estate'` |

**SQL แนะนำ:**
```sql
cm."group" = 'Hospitality & Real Estate' AND cm.industry = 'Real Estate'
```

> ถ้าต้องการทั้ง Hotel + Real Estate (พบบ่อยใน Hospitality search):
```sql
cm."group" = 'Hospitality & Real Estate'
```

---

### 🏦 Finance, Banking & Insurance

| User พูดว่า | group | industry |
|-------------|-------|----------|
| ธนาคาร, Bank, Banking | `'Financial Services / Banking / Insurance'` | `'Banking / Financial Services'` |
| ประกัน, Insurance | `'Financial Services / Banking / Insurance'` | `'Insurance'` |
| Investment, Fund, Asset Management | `'Financial Services / Banking / Insurance'` | `'Investment Management'` |
| Finance, Financial Services | `'Financial Services / Banking / Insurance'` | `'Banking / Financial Services'` |

**SQL แนะนำ:**
```sql
cm."group" = 'Financial Services / Banking / Insurance'
-- เพิ่ม industry ถ้าต้องการเจาะ เช่น AND cm.industry = 'Insurance'
```

---

### 🛍️ Retail & ค้าปลีก

| User พูดว่า | group | industry |
|-------------|-------|----------|
| Retail, ค้าปลีก | `'Retail / FMCG / F&B'` | `'Retail'` |
| Fashion, เสื้อผ้า | `'Retail / FMCG / F&B'` | `'Retail Apparel and Fashion'` |
| Luxury Retail, สินค้าแบรนด์เนม | `'Retail / FMCG / F&B'` | `'Retail Luxury Goods'` |
| Sport Retail | `'Retail / FMCG / F&B'` | `'Retail Sport'` |
| ห้างสรรพสินค้า, Department Store | `'Retail / FMCG / F&B'` | `'Retail'` |

**SQL แนะนำ:**
```sql
cm."group" = 'Retail / FMCG / F&B' AND cm.industry ILIKE 'Retail%'
```

---

### 🍔 Food & Beverage

| User พูดว่า | group | industry |
|-------------|-------|----------|
| F&B, Food and Beverage, ร้านอาหาร | `'Retail / FMCG / F&B'` | `'Food and Beverage'` |
| Food Manufacturing, โรงงานอาหาร | `'Retail / FMCG / F&B'` | `'Food and Beverage Manufacturing'` |
| Restaurant Chain, QSR | `'Retail / FMCG / F&B'` | `'Food and Beverage'` |

**SQL แนะนำ:**
```sql
cm."group" = 'Retail / FMCG / F&B' 
AND cm.industry IN ('Food and Beverage', 'Food and Beverage Manufacturing')
```

---

### 🧴 FMCG & Consumer Goods

| User พูดว่า | group | industry |
|-------------|-------|----------|
| FMCG, Consumer Goods, สินค้าอุปโภค | `'Retail / FMCG / F&B'` | `'FMCG / Consumer Goods'` |
| Personal Care, Beauty, สินค้าความงาม | `'Retail / FMCG / F&B'` | `'Personal Care Product'` |

**SQL แนะนำ:**
```sql
cm."group" = 'Retail / FMCG / F&B' 
AND cm.industry IN ('FMCG / Consumer Goods', 'Personal Care Product')
```

---

### 💻 Technology & IT

| User พูดว่า | group | industry |
|-------------|-------|----------|
| Tech, IT, Technology | `'Technology / Digital / Telecom'` | `'Information Technology & Services'` |
| Software, SaaS | `'Technology / Digital / Telecom'` | `'Software Development'` |
| IT Consulting | `'Technology / Digital / Telecom'` | `'IT Services and IT Consulting'` |
| Telecom, โทรคมนาคม | `'Technology / Digital / Telecom'` | `'Telecommunications'` |
| E-commerce, Digital | `'Technology / Digital / Telecom'` | `'E-commerce / Digital Business'` |

**SQL แนะนำ:**
```sql
cm."group" = 'Technology / Digital / Telecom'
```

---

### 📊 Consulting

| User พูดว่า | group | industry |
|-------------|-------|----------|
| Consulting, ที่ปรึกษา, Big 4 | `'Consulting Firm / Consulting Services'` | `'Consulting'` |
| Management Consulting | `'Consulting Firm / Consulting Services'` | `'Business Consulting and Services'` |

**SQL แนะนำ:**
```sql
cm."group" = 'Consulting Firm / Consulting Services'
```

---

### 🏥 Healthcare & Medical

| User พูดว่า | group | industry |
|-------------|-------|----------|
| โรงพยาบาล, Hospital | `'Others'` | `'Hospital'` |
| Pharmaceutical, ยา | `'Others'` | `'Pharmaceutical'` |
| Medical Device | `'Others'` | `'Medical Device Manufacturing'` |
| Healthcare, Health & Wellness | `'Others'` | `'Health, Wellness and Fitness'` |

**SQL แนะนำ:**
```sql
cm.industry IN ('Hospital', 'Pharmaceutical', 'Medical Device Manufacturing', 'Health, Wellness and Fitness')
```

---

### 🏭 Manufacturing

| User พูดว่า | group | industry |
|-------------|-------|----------|
| Manufacturing, โรงงาน | `'Others'` | `'Manufacturing'` |
| Automotive, รถยนต์ | `'Others'` | `'Motor Vehicle Manufacturing'` |
| Chemical | `'Others'` | `'Chemical Manufacturing'` |

**SQL แนะนำ:**
```sql
cm.industry ILIKE '%Manufacturing%'
```

---

### 🚚 Logistics & Supply Chain

| User พูดว่า | group | industry |
|-------------|-------|----------|
| Logistics, Supply Chain, ขนส่ง | `'Others'` | `'Transportation, Logistics, Supply Chain'` |

**SQL แนะนำ:**
```sql
cm.industry IN ('Transportation, Logistics, Supply Chain', 'Logistics', 'Logistics / Supply Chain')
```

---

## ข้อควรระวัง

### 1. Wait AI Check
บาง company ยังอยู่ในสถานะ `industry = 'Wait AI Check'` (รอ AI classify)
ใน Stage 1 ให้รวมไว้ด้วยเสมอเพื่อไม่ให้พลาด:

```sql
(cm."group" = 'Hospitality & Real Estate' OR cm.industry = 'Wait AI Check' OR cm.industry IS NULL)
```

### 2. candidate_experiences มี company_industry column ด้วย
นอกจาก JOIN company_master แล้ว ยังมี `ce.company_industry` และ `ce.company_group` ใน `candidate_experiences` โดยตรง ใช้เป็น fallback ได้:

```sql
AND (
  cm."group" = 'Hospitality & Real Estate'
  OR ce.company_industry ILIKE '%Hotel%'
  OR ce.company_industry ILIKE '%Hospitality%'
)
```

### 3. ไม่ต้อง filter industry ใน Stage 1 เสมอไป
ถ้า user ระบุ role ชัดมาก (เช่น `F&B Manager`, `Revenue Manager`) 
industry filter อาจไม่จำเป็น เพราะ role นั้นบ่งบอก industry อยู่แล้ว

---

## สถิติ (April 2026)

| group | จำนวน company |
|-------|--------------|
| Retail / FMCG / F&B | 3,717 |
| Others | 3,158 |
| Hospitality & Real Estate | 2,244 |
| Financial Services / Banking / Insurance | 981 |
| Technology / Digital / Telecom | 953 |
| Consulting Firm / Consulting Services | 898 |
| Wait AI Check (pending) | ~1,164 |
