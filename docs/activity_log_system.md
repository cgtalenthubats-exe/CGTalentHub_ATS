# Activity Log System — Plan & Architecture (รอ confirm)

> **STATUS: PROPOSAL** — ยังไม่ได้ implement อะไรทั้งสิ้น ไฟล์นี้คือแผนที่ไล่เช็คทั้งระบบแล้วเสนอให้ยืนยันก่อนลงมือ
> วัตถุประสงค์: log ว่า **ใคร ทำอะไร กับข้อมูลไหน เมื่อไหร่ เปลี่ยนจากอะไรเป็นอะไร** — ดูหลังบ้านเท่านั้น (admin only)

---

## 1. สรุปคำตอบ: ทำได้มั้ย

**ทำได้ครับ** และทำได้ค่อนข้างครบด้วย แต่มี 3 ข้อจำกัดเชิงสถาปัตยกรรมที่ต้องออกแบบรอบๆ มัน (ไม่ใช่ blocker แต่ตัดสินใจผิดตั้งแต่แรกจะเก็บ actor ไม่ได้เลย):

| # | ข้อจำกัดที่เจอจริงในโค้ด | ผลกระทบ |
|---|---|---|
| 1 | ทุก write ฝั่ง server ใช้ `adminAuthClient` (service role, bypass RLS) — `src/lib/supabase/admin.ts` | Postgres trigger จะเห็น `auth.uid()` เป็น service_role เสมอ → **DB trigger เพียวๆ ไม่รู้ว่าใครทำ** ต้องส่ง actor ลงไปเอง |
| 2 | มี write ที่ยิงจาก browser client ตรงๆ ไม่ผ่าน server action | ถ้า log เฉพาะ app layer จะมีรูรั่ว (ดูข้อ 4.3) |
| 3 | มี write จาก n8n callback (`/api/n8n/callback`, `/api/n8n/org-chart/callback`) | actor ต้องเป็น `n8n` / `system` ไม่ใช่ user |

ตัวระบุตัวตนที่มีอยู่แล้วและใช้ต่อได้เลย:
- `getCurrentUserEmail()` — `src/app/actions/status-updates.ts:8` (อ่านจาก Supabase session cookie)
- `getCurrentUserRealName()` — `src/app/actions/user-actions.ts` (map email → `user_profiles.real_name`)
- `user_profiles` มี column `role` ('user' / 'admin') อยู่แล้ว แต่ **ยังไม่ถูก enforce ที่ไหนเลย** (middleware เช็คแค่ว่าอยู่ใน whitelist) → ต้องเพิ่ม gate ก่อนทำหน้าหลังบ้าน

---

## 2. ของที่มีอยู่แล้ว (partial audit) — ห้ามทำซ้ำ

| ตาราง | เก็บอะไร | ครอบคลุมแค่ไหน |
|---|---|---|
| `status_log` | ทุก status change ของ candidate ใน JR (`updated_by`, `timestamp`, `note`) | ดีที่สุดที่มีอยู่ — ใช้ใน 32 จุดทั่วระบบ, มี UI แล้ว (`CandidateActivityLog`, `HistoryTimeline`) |
| `csv_upload_logs` | ประวัติ import CSV (`uploader_email`, batch_name, status) | เฉพาะ import |
| `resume_uploads` | ประวัติอัพโหลด resume (`uploader_email`, status, note) | เฉพาะ resume |
| `org_chart_uploads` | ประวัติอัพโหลด org chart (upload_id, status, modify_date) | เฉพาะ org chart, **ไม่มี actor** |
| `pre_screen_log` | ผล pre-screen | เฉพาะ pre-screen |
| `n8n_logs`, `test_encoding_logs` | debug log | ไม่ใช่ audit |

**สรุป: มี log แบบ "แยกฟีเจอร์ใครฟีเจอร์มัน" แต่ไม่มีตัวกลางที่ตอบคำถามว่า "เมื่อวานทีมทำอะไรไปบ้าง" หรือ "ใครลบ candidate คนนี้"**
→ ของใหม่จะเป็น **layer รวมด้านบน ไม่ไปแตะของเดิม** (`status_log` ยังทำงานเหมือนเดิมทุกประการ)

---

## 3. Schema ที่เสนอ — `activity_log`

```sql
create table public.activity_log (
  id             bigserial primary key,
  occurred_at    timestamptz not null default now(),

  -- ใคร
  actor_email    text,
  actor_name     text,                     -- snapshot ของ real_name ตอนนั้น (ไม่ join ย้อนหลัง)
  actor_type     text not null default 'user',   -- user | n8n | system | ai
  actor_role     text,                     -- snapshot ของ role ตอนนั้น

  -- ทำอะไร
  action         text not null,            -- create | update | delete | bulk_create | bulk_delete
                                           -- | status_change | login | logout | export | search | ai_run | upload
  entity_type    text,                     -- candidate | jr | jr_candidate | experience | company
                                           -- | user | org_chart | resume | setting | placement
  entity_id      text,
  entity_label   text,                     -- ชื่อคน / JR000214 — denormalized ไว้ให้อ่านออกแม้ record ถูกลบไปแล้ว
  parent_type    text,                     -- เช่น jr_candidate อยู่ใต้ jr
  parent_id      text,

  -- รายละเอียด
  summary        text,                     -- "เปลี่ยนสถานะ Interview → Offer", "ลบ JR000214 (12 candidates)"
  changes        jsonb,                    -- { "field": { "from": ..., "to": ... } } เฉพาะ field ที่เปลี่ยนจริง
  metadata       jsonb,                    -- filter payload, batch_id, row_count, model, duration_ms

  -- context
  source         text,                     -- route ที่กดมา เช่น /requisitions/manage
  request_id     text,
  ip             text,
  user_agent     text,

  status         text not null default 'success',  -- success | failed
  error_message  text
);

create index on activity_log (occurred_at desc);
create index on activity_log (entity_type, entity_id, occurred_at desc);
create index on activity_log (actor_email, occurred_at desc);
create index on activity_log (action, occurred_at desc);
create index on activity_log using gin (changes);
```

**Append-only:** เปิด RLS + ไม่มี policy สำหรับ anon/authenticated เลย (เขียน/อ่านผ่าน service role เท่านั้น) และ `revoke update, delete on activity_log from public` — log ที่แก้ได้ = log ที่เชื่อไม่ได้

**ทำไมเก็บ `entity_label` ซ้ำซ้อน:** เพราะ log ที่มีค่าที่สุดคือ log ตอน "ลบ" — ถ้า join กลับไปหา `Candidate Profile` มันไม่มีแล้ว

**ทำไมเก็บ `changes` เป็น diff ไม่ใช่ full row:** ตาราง `Candidate Profile` / `candidate_experiences` กว้างมาก เก็บ full snapshot ทุก update = log โตเร็วกว่าตัวข้อมูลจริง

---

## 4. วิธีเก็บ — 3 ชั้น

### 4.1 Layer A — App layer (ชั้นหลัก, ได้ "เจตนา" ของ action)

ไฟล์ใหม่ `src/lib/activity-log.ts`:

```ts
logActivity({ action, entityType, entityId, entityLabel, summary, changes, metadata, source })
```

หลักการ:
- **fire-and-forget + never throw** — log พังต้องไม่ทำให้ user ทำงานไม่ได้ (try/catch กลืน error, console.error อย่างเดียว)
- resolve actor เองจาก `getCurrentUserEmail()` + cache `real_name` ต่อ request
- มี `diffFields(before, after)` helper — คืนเฉพาะ field ที่ค่าเปลี่ยนจริง
- มี `withActivityLog()` wrapper สำหรับ server action ที่รูปแบบตรงมาตรฐาน

**หมายเหตุสำคัญ:** action หลายตัวตอนนี้ `update` ตรงๆ โดยไม่ได้อ่านค่าเดิมก่อน (เช่น `updateJobRequisition`, `updateHeadRecruitNote`) → ถ้าอยากได้ `from → to` ต้องเพิ่ม `select` ก่อน update ในจุดที่ต้องการ (+1 query ต่อ action — ยอมรับได้เพราะเป็น action ที่ user กดเอง ไม่ใช่ hot path)

### 4.2 Layer B — DB trigger (ชั้น safety net, จับสิ่งที่หลุดจาก Layer A)

Generic trigger function เขียน diff ของ row ลง `activity_log` สำหรับตารางแกน:
`Candidate Profile`, `candidate_experiences`, `jr_candidates`, `job_requisitions`, `employment_record`, `company_master`, `user_profiles`

Actor มาจากไหน (เพราะ service role ไม่มี identity):
```sql
coalesce(
  current_setting('request.headers', true)::json ->> 'x-actor-email',  -- PostgREST expose header ให้
  'unknown'
)
```
ต้องคู่กับการเปลี่ยน `adminAuthClient` จาก singleton → **factory ต่อ request** ที่ใส่ header `x-actor-email` ลงไป:
```ts
export function getAdminClient(actorEmail?: string) // global.headers: { 'x-actor-email': ... }
```
(singleton เดิมยังคงไว้ได้เพื่อไม่ต้องแก้ทุกไฟล์พร้อมกัน — ค่อยๆ migrate)

**กันไม่ให้ log ระเบิดตอน bulk:** import CSV ทีละ 5,000 rows จะได้ 5,000 log rows — วิธีคุม: ตั้ง GUC `app.suppress_row_audit = 'on'` ระหว่าง bulk operation แล้ว trigger skip, โดยให้ Layer A เขียน log สรุป 1 แถวแทน (`action='bulk_create'`, `metadata.row_count=5000`, `metadata.batch_id`)

### 4.3 รูรั่วที่ต้องปิดด้วย Layer B (write ที่ไม่ผ่าน server action)

| ไฟล์ | เขียนอะไร |
|---|---|
| `src/app/candidates/new/page.tsx` | insert `Candidate Profile`, `candidate_experiences`, `company_master`, update photo |
| `src/app/candidates/[id]/experiences/new/page.tsx` | insert `candidate_experiences`, `company_master` |
| `src/components/settings/ai-settings.tsx` | upsert `n8n_configs` |
| `src/components/org-chart/org-chart-viewer-v2.tsx` | write `org_charts` |
| `src/components/resume-manager.tsx`, `candidate-edit-form.tsx`, `add-feedback-dialog.tsx` | storage upload (avatars / resumes) |
| `/api/n8n/callback`, `/api/n8n/org-chart/callback` | insert candidate + experiences + enhance (actor = n8n) |

### 4.4 Layer C — Usage events (ไม่มี DB write แต่ user "ใช้งาน")

ใช้ helper ตัวเดียวกัน แค่ action ต่างกัน:
- `login` / `logout` — hook ที่ `src/app/auth/callback/route.ts`
- `search` — AI search demo / v3 / candidate explorer (เก็บ filter payload + result count ลง `metadata`)
- `export` — CSV / PPTX / PDF / share report (`export-jr-report.ts`, `export-pptx.ts`, `export-placement-report.ts`, `csv-actions.ts`)
- `ai_run` — trigger n8n stage 2/3, ranking, parse (เก็บ model + jr_id + candidate count)
- `view` (optional) — เปิดหน้า/โปรไฟล์ candidate — **volume สูงสุด แนะนำยังไม่ทำใน phase แรก**

---

## 5. Coverage map — ไล่ทั้งระบบแล้วต้องแทรกตรงไหนบ้าง

พบไฟล์ที่มี write operation **34 ไฟล์** จัดลำดับตามคุณค่าของ log:

### P0 — คนถามหาบ่อยที่สุด ("ใครแก้/ใครลบ")
| ไฟล์ | Action ที่ต้อง log |
|---|---|
| `actions/status-updates.ts` | `updateCandidateStatus`, `batchUpdateCandidateStatus`, `removeFromJR`, `copyCandidatesToJR`, `updateHeadRecruitFeedback/Note` |
| `actions/requisitions.ts` | `createJobRequisition`, `updateJobRequisition`, `updateJobRequisitionStatus`, `copyJobRequisition`, **`deleteJobRequisition`** (ลบ JR + status_log ด้วย) |
| `actions/jr-candidates.ts` | `addCandidatesToJR`, `bulkAddCandidatesToJR`, `bulkAddByFilterToJR` |
| `actions/placement.ts` | `confirmPlacement` (แตะ 3 ตาราง + status_log) |
| `api/candidates/[id]/route.ts` | update profile / **delete candidate** (ลบ experiences + status_log + pre_screen_log + csv logs) |
| `actions/candidate.ts` | insert/update/delete `candidate_experiences` |
| `actions/user-actions.ts` | upsert / delete `user_profiles` ← สิทธิ์คนเข้าระบบ ต้อง log แน่นอน |

### P1 — ตั้งค่า/ข้อมูล master ที่กระทบทั้งระบบ
`admin-actions.ts` (n8n_configs) · `app-settings.ts` · `status-master.ts` · `company-mgmt.ts` (company + hotel_chain) · `company-industry.ts` · `cg-group-companies.ts` · `candidate-filters.ts`

### P2 — Import / bulk / ไฟล์ (log แบบสรุปต่อ batch)
`csv-actions.ts` · `report-actions.ts` (ลบ enhance + resume_uploads) · `resume-actions.ts` · `org-chart-actions.ts` (42 write ops — เยอะสุดในระบบ) · `internal-candidates.ts` · `consolidate_gm_hotel.ts`

### P3 — AI / session (log แบบ event)
`ai-search.ts` · `ai-search-v2.ts` · `ai-search-ranking.ts` · `ai-ranking.ts` · `assistant-actions.ts` · `jr-ai-chat.ts` · `n8n-actions.ts` · `pre-screen-actions.ts` · `interview-feedback.ts` · `jr-candidate-logs.ts` (แก้/ลบ status_log เอง — ต้อง log ว่ามีคนแก้ log!)

---

## 6. หน้าดูหลังบ้าน — `/admin/activity-log`

**ก่อนอื่นต้องมี access control จริงก่อน:** ตอนนี้ `/admin/*` ใครก็ตามที่อยู่ใน whitelist เข้าได้หมด
→ เพิ่มเช็ค `user_profiles.role = 'admin'` ใน `src/middleware.ts` สำหรับ path `/admin/*` (ได้ผลพลอยได้กับ `/admin/companies`, `/admin/n8n` ด้วย)

UI:
- **Timeline view** เรียงเวลาล่าสุด — แถวเดียวอ่านรู้เรื่อง: `[เวลา] [avatar/ชื่อ] [badge action] summary`
- **Filters**: ช่วงวันที่ (default 7 วัน) · actor · action · entity type · ค้นด้วยชื่อ/id
- **Expand แถว** → ตาราง diff `field | จาก | เป็น` + metadata + source route
- **Cursor pagination** (keyset ด้วย `occurred_at, id`) ไม่ใช่ offset — ตารางนี้จะโตเร็ว
- **Export CSV** สำหรับ audit จริงจัง
- **Entity view**: `/admin/activity-log?entity=candidate:12345` เพื่อดูประวัติของ record เดียว (reuse ในหน้า candidate ภายหลังได้)
- Summary bar: จำนวน action วันนี้ / top actor / top action

---

## 7. Retention, ขนาด, ความเป็นส่วนตัว

- **Retention 12 เดือน** (เสนอ) — cron ลบของเก่ากว่านั้น หรือย้ายไปตาราง cold
- ถ้าโตเร็วกว่าคาด → partition by month (`activity_log_2026_09`) ทีหลังได้โดยไม่ต้องแก้ app
- **ไม่เก็บค่า sensitive แบบ plain ใน `changes`** — field กลุ่มเงินเดือน (`employment_record`), เบอร์โทร, email ส่วนตัวของ candidate → เก็บแค่ `{"salary": {"changed": true}}` (list field ที่ mask ตั้งเป็น constant ในโค้ด)
- log นี้ **ดูหลังบ้านอย่างเดียว** — ไม่ expose ผ่าน API ที่ client เรียกได้ ไม่โผล่ใน UI ฝั่ง recruiter

---

## 8. แผนลงมือ (ประมาณการ)

| Phase | งาน | ผลลัพธ์ที่จับต้องได้ |
|---|---|---|
| **0** | migration `activity_log` + `src/lib/activity-log.ts` + admin gate ใน middleware | โครงพร้อม เขียน log ได้ |
| **1** | hook P0 ทั้งหมด (status, JR, jr_candidates, placement, candidate delete, user_profiles) | ตอบได้แล้วว่า "ใครแก้อะไรกับ candidate/JR" |
| **2** | หน้า `/admin/activity-log` (timeline + filter + diff + pagination) | ดูได้จริง |
| **3** | DB trigger safety net + `x-actor-email` header + suppress flag ตอน bulk | ปิดรูรั่ว browser-client / n8n / SQL มือ |
| **4** | P1–P3 + usage events (login, search, export, ai_run) + retention cron | ครบวงจร |

**Phase 0–2 คือ MVP ที่ใช้งานได้จริงแล้ว** — ทำไปทีละ phase แล้วดูของจริงก่อนขยายได้

---

## 9. เรื่องที่ต้องตัดสินใจก่อนเริ่ม (รอ confirm)

| # | คำถาม | ที่แนะนำ |
|---|---|---|
| 1 | เก็บ diff ทุก field หรือเฉพาะ field สำคัญ? | เก็บทุก field ที่เปลี่ยน ยกเว้น field ใน mask list |
| 2 | Bulk import: log ต่อ row หรือต่อ batch? | ต่อ batch (1 แถว + row_count) ไม่งั้น log ท่วม |
| 3 | เก็บ `view` (เปิดดูหน้า/โปรไฟล์) ด้วยมั้ย? | **ยังไม่เก็บใน phase แรก** — volume สูง คุณค่าต่ำกว่า write log มาก ถ้าจำเป็นค่อยเพิ่มทีหลัง |
| 4 | Retention | 12 เดือน |
| 5 | ใครดูได้ | `role = 'admin'` เท่านั้น (ต้องไปตั้ง role ให้ user ที่ควรเป็น admin ใน Settings ก่อน) |
| 6 | log การ search/AI run ด้วยมั้ย | เก็บ — มีประโยชน์กับการดู adoption ของ AI Search และ cost |

---

*Created: 2026-09-10 | Activity Log System v0 (proposal — ยังไม่ implement)*
