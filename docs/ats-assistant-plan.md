# ATS Assistant — แผนงาน

## Architecture

```
ATS Chat UI (Next.js /assistant)
    ↓
Gemini AI Agent (+ Gemini API Key)
    ├── Supabase MCP  ← มีอยู่แล้ว
    │   └── CRUD: candidates, JR, jr_candidates, status
    └── n8n MCP Server  ← ต้องสร้าง
        ├── search_candidates  → n8n vector search webhook
        ├── create_jr          → n8n create JR webhook
        ├── add_candidates_to_jr → n8n bulk insert webhook
        └── ... เพิ่มได้ภายหลัง
```

## สิ่งที่ต้องสร้าง

### 1. n8n MCP Server (Node.js)
- expose n8n webhooks เป็น MCP tools
- แต่ละ tool = POST ไปหา n8n webhook URL
- ต้องรู้ webhook URLs ก่อน (vector search มีแล้ว)

### 2. n8n Webhooks ใหม่
| Webhook | Action |
|---------|--------|
| `/webhook/create-jr` | สร้าง JR ใน Supabase |
| `/webhook/add-candidates` | bulk insert ลง jr_candidates |

> *(Vector search มีอยู่แล้ว)*

### 3. Chat UI
- หน้า `/assistant` ใน Next.js ATS app
- ส่ง message → Gemini API พร้อม tools ทั้งสอง MCP
- แสดงผล + tool call results

### 4. System Prompt
- บอก Gemini ว่ามีข้อมูลอะไร
- Business rules เช่น JR ต้องกรอกอะไรบ้าง

## Example Flow

```
User: "หา GM ด้านโรงแรมในไทย"
  → Gemini เรียก n8n MCP: search_candidates(position="GM", industry="hotel", country="Thailand")
  → แสดงผล 10 คน

User: "เพิ่มทั้งหมดลง JR ใหม่"
  → Gemini ขาดข้อมูล → ถาม "Job Title, Department, Client?"
  → User ตอบ
  → Gemini เรียก Supabase MCP: create_jr(...)  → ได้ JR_ID
  → Gemini เรียก Supabase MCP: add_candidates_to_jr(jr_id, [...])
  → ตอบ "เสร็จแล้ว! JR0000999"
```

## ข้อมูลที่ต้องรวบรวมก่อนเริ่ม
- [ ] n8n webhook URL สำหรับ vector search
- [ ] Gemini API Key
- [ ] รายการ fields ที่ required สำหรับสร้าง JR
