# AI Search System Overview

## Flow

```
User พิมพ์ query
"Find GM of 4-5 star hotel in Thailand"
        ↓
AI Agent (1 call)
แปลง NL → Filter JSON
        ↓
Frontend รับ JSON
ใส่ Dynamic Filter อัตโนมัติ
แสดง candidate list ทันที
        ↓
User ดูผล / ปรับ filter เองได้
หรือพิมพ์ refine ต่อใน chat
        ↓
พอใจแล้ว → กด "ประเมิน"
        ↓
Stage 2 Screening (background)
Stage 3 Ranking (background)
        ↓
แสดง Top 20 พร้อม score + เหตุผล
```

## Stages

| Stage | ชื่อ | หน้าที่ |
|---|---|---|
| Stage 1 | AI Preliminary | แปลง query → filter params, แสดงผล candidate list เบื้องต้น |
| Stage 2 | Screen | กรอง Pass/Fail เทียบ experiences vs original query (background) |
| Stage 3 | Evaluate | ให้คะแนน หา Top 20 (background) |

## Stage 1 — Filter Params (AI Output)

```json
{
  "position_keywords": ["General Manager / GM"],
  "industry_group": "Hotel",
  "industry": null,
  "countries": ["Thailand"],
  "region": null,
  "company_rating": ["4 Star", "5 Star"],
  "companies": []
}
```

## Key Design Decisions

- AI ทำแค่ **1 call** — NL → JSON ไม่มี back-and-forth
- Vocab (position_keyword_vocab, industry_group, country) embed ใน prompt แบบ static
- Frontend จัดการ query, filter, แสดงผลเอง — ไม่ผ่าน AI อีก
- User ปรับ filter ได้เองหลัง AI set ให้แล้ว
- Stage 2 & 3 รันใน background หลัง user กด "ประเมิน"
