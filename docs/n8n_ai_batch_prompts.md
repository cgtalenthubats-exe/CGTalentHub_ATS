# n8n AI Batch Prompts

> **สร้าง:** April 2026  
> **วัตถุประสงค์:** Prompt templates สำหรับ n8n วนลูป batch ส่ง AI เติมข้อมูลที่ยังขาด

---

## 1. position_keyword — Tier 2

ใช้หลัง Tier 1 (rule-based SQL) เสร็จแล้ว  
เป้าหมาย: map ~4,200 positions ที่ยังเป็น NULL ให้เข้า vocab v1

### SQL ดึง batch

```sql
SELECT DISTINCT position
FROM candidate_experiences
WHERE position IS NOT NULL
  AND position_keyword IS NULL
ORDER BY position
LIMIT 100 OFFSET {{offset}}
```

### Prompt

```
You are a job title normalizer for an HR database.

Map each job title below to EXACTLY ONE value from the approved vocab list.

Rules:
- Return ONLY a JSON array, no explanation
- If no good match exists → use "unclear"
- Do NOT create new values outside the list

=== APPROVED VOCAB LIST ===
CEO / Chief Executive Officer
CFO / Chief Financial Officer
COO / Chief Operating Officer
CTO / Chief Technology Officer
CMO / Chief Marketing Officer
CHRO / Chief HR Officer
CCO / Chief Commercial Officer
CDO / Chief Data Officer
CIO / Chief Information Officer
CSO / Chief Strategy Officer
CPO / Chief Product Officer
CMercO / Chief Merchandising Officer
Managing Director
Chairman / Board Member
Founder / Co-Founder
President
General Manager
Country Manager / Regional Manager
Deputy General Manager
Vice President
DOSM / Director of Sales & Marketing
Sales Director
Marketing Director
HR Director
Finance Director
Operations Director
Business Development Director
Legal Director / General Counsel
Director of Rooms
Director
Front Office Manager
F&B Manager
Revenue Manager
Executive Chef
Guest Services Manager
Sales Manager
Marketing Manager
HR Manager
Finance Manager
Operations Manager
Business Development Manager
Project Director
Project Manager
Store Manager
Retail Director
Buying Manager
Legal Manager
Partner / Principal
Consultant / Advisor
Associate
Software Engineer
Data Scientist
Business Analyst
Designer
Architect
Manager

=== OUTPUT FORMAT ===
[
  {"raw": "Hotel GM", "keyword": "General Manager"},
  {"raw": "Weird Title XYZ", "keyword": "unclear"}
]

=== JOB TITLES TO MAP ===
{{positions}}
```

### SQL update กลับเข้า DB

```sql
UPDATE candidate_experiences
SET position_keyword = '{{keyword}}'
WHERE position = '{{raw}}'
  AND position_keyword IS NULL;
```

> **หมายเหตุ:** ค่า "unclear" ไม่ต้อง update — ปล่อย NULL ไว้ review ทีหลัง

---

## 2. company_master — เติม industry / group

เป้าหมาย: เติม industry และ group ให้ ~1,164 masters ที่ยัง `Wait AI Check`

### SQL ดึง batch

```sql
SELECT company_id, company_master
FROM company_master
WHERE industry = 'Wait AI Check'
ORDER BY company_id
LIMIT 50 OFFSET {{offset}}
```

### Prompt

```
You are a company classifier for an HR database.

Classify each company below into industry and group.

Rules:
- Return ONLY a JSON array, no explanation
- Use ONLY values from the approved lists below
- If unsure → industry: "Others", group: "Others"

=== APPROVED industry VALUES (examples) ===
Hospitality | Hotel | Food and Beverage | Retail | Banking / Financial Services
Information Technology & Services | Real Estate | Consulting | Insurance
Pharmaceutical | Manufacturing | Education | Government Administration
Transportation, Logistics, Supply Chain | Others

=== APPROVED group VALUES (exactly these 6) ===
Hospitality & Real Estate
Retail / FMCG / F&B
Technology / Digital / Telecom
Financial Services / Banking / Insurance
Consulting Firm / Consulting Services
Others

=== OUTPUT FORMAT ===
[
  {"company_id": 123, "industry": "Hospitality", "group": "Hospitality & Real Estate"},
  {"company_id": 456, "industry": "Others", "group": "Others"}
]

=== COMPANIES TO CLASSIFY ===
{{companies}}
```

### SQL update กลับเข้า DB

```sql
UPDATE company_master
SET industry = '{{industry}}', "group" = '{{group}}'
WHERE company_id = {{company_id}}
  AND industry = 'Wait AI Check';
```

---

## 3. company_master — เติม rating (ดาวโรงแรม)

เป้าหมาย: เติม rating ให้ Hospitality masters ~1,900 ตัวที่ยังไม่มีดาว

### SQL ดึง batch

```sql
SELECT company_id, company_master
FROM company_master
WHERE "group" = 'Hospitality & Real Estate'
  AND rating IS NULL
  AND industry != 'Wait AI Check'
ORDER BY company_id
LIMIT 50 OFFSET {{offset}}
```

### Prompt

```
You are a hotel rating specialist.

Estimate the star rating for each hotel/hospitality company below.

Rules:
- Return ONLY a JSON array, no explanation
- Use ONLY these values: "5 Star", "4 Star", "3 Star", "2 Star", "1 Star", "unclear"
- Base your answer on brand name and reputation
- If it's a hotel management company / group HQ (not a property) → "unclear"
- If unsure → "unclear"

=== OUTPUT FORMAT ===
[
  {"company_id": 123, "rating": "5 Star"},
  {"company_id": 456, "rating": "unclear"}
]

=== HOTELS TO RATE ===
{{companies}}
```

### SQL update กลับเข้า DB

```sql
UPDATE company_master
SET rating = '{{rating}}'
WHERE company_id = {{company_id}}
  AND rating IS NULL;
```

> **หมายเหตุ:** ค่า "unclear" ไม่ต้อง update — ปล่อย NULL ไว้

---

## สถานะ (April 2026)

| งาน | สถานะ | จำนวนที่ต้องทำ |
|---|---|---|
| position_keyword Tier 2 | ⏳ รอ n8n | ~4,200 rows |
| company_master industry/group | ⏳ รอ n8n | 1,164 masters |
| company_master rating | ⏳ รอ n8n | ~1,900 masters |
| rating format fix (4 Star vs 5 Stars) | ⏳ รอทำ | เล็กน้อย |