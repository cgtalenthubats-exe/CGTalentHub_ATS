# Data Freshness / Refresh — สำรวจอาการ "ต้อง hard refresh ถึงจะเห็นข้อมูล"

> **STATUS: สำรวจ + เสนอไอเดีย** — ยังไม่ได้แก้โค้ด
> Context: user feedback ว่าหลังใส่/แก้ข้อมูลแล้วไม่เห็นผล ต้อง hard refresh · concurrent users สูงสุด 5 คน

## ขอบเขตที่ยืนยันกับ user แล้ว (2026-09-16)

**ปัญหาหลักคือ "ข้อมูลของตัวเอง"** — user กดบันทึก เห็น toast ว่าสำเร็จ แต่หน้าจอไม่เปลี่ยน เลยไม่รู้ว่าบันทึกไปแล้วรึยัง ต้อง hard refresh เช็คเอง
ตัวอย่างที่ user ยกมา: **Add Interview Feedback**

**เรื่องเห็นข้อมูลของคนอื่นแบบ realtime = ไม่สำคัญในรอบนี้** → ข้อ 2.4 และ Phase 3 (Realtime) ถือว่า out of scope
→ **ส่วนที่ต้องทำจริงคือหัวข้อ 7 (Fix List) ท้ายไฟล์**

---

## 0. ข้อสรุปที่ต้องรู้ก่อน (แก้ความเข้าใจเดิม)

> "เข้าใจว่าระบบเรามีตั้ง poll refresh ไว้อยู่ใช่ป้ะ แต่น่าจะไม่ทันใจ user"

**ระบบ ไม่มี poll refresh สำหรับข้อมูล candidate / JR / status เลยครับ** — `setInterval` ที่มีอยู่ 11 จุดเป็น **poll สถานะ AI job** ทั้งหมด (รอผล Stage 2/3, org-chart parsing) ไม่ใช่การ refresh ข้อมูลหน้าจอ:

| ไฟล์ | interval | poll อะไร |
|---|---|---|
| `ai-search-v3/Stage3ResultsPanel.tsx:504` | 4s | สถานะ ranking job |
| `ai-search-demo/Stage3Panel.tsx:281` | — | สถานะ ranking job |
| `requisitions/manage/ai-suggestion-tab.tsx:954` | — | สถานะ AI suggestion job |
| `ai-search-v2/page.tsx:135,143` | 5s | report + pipeline status |
| `ai-search/page.tsx:50` | — | search job status |
| `org-chart/parse-image-dialog.tsx:120` | — | ข้อความ loading (ไม่ใช่ data) |

ดังนั้นอาการนี้**ไม่ได้เกิดจาก "poll ช้าไป" แต่เกิดจาก "ไม่มีอะไรสั่งให้โหลดใหม่เลย"** — เพิ่มความถี่ poll ก็ไม่ช่วย เพราะไม่มี poll ให้เพิ่ม

**สาเหตุจริง:** ระบบใช้วิธี refresh อยู่ **5 แบบปนกัน** และ **2 แบบในนั้นไม่ทำงานเลย**ในหน้าที่เป็น client component (ซึ่งคือ 32 จาก 39 หน้าของระบบ)

---

## 1. Refresh 5 แบบที่ใช้อยู่ — แบบไหนได้ผล แบบไหนไม่

| # | วิธี | ใช้กี่จุด | ได้ผลมั้ย |
|---|---|---|---|
| 1 | `revalidatePath()` ใน server action | **98 จุด** | ❌ **แทบไม่มีผล** — invalidate cache ฝั่ง Next server แต่หน้าที่เป็น client component ถือข้อมูลใน `useState` ของตัวเอง ไม่ได้อ่านจาก cache ตัวนั้น |
| 2 | `router.refresh()` | 34 จุด / 17 ไฟล์ | ⚠️ **ได้ผลเฉพาะหน้า server component** (org-chart, `/requisitions/manage/candidate/[id]`) — บน client page ไม่ remount → `useEffect` ไม่ยิงซ้ำ → ข้อมูลเดิม |
| 3 | `window.location.reload()` | 5 จุด / 3 ไฟล์ | ✅ ได้ผลเสมอ แต่คือการ "hard refresh ให้ user อัตโนมัติ" — เสีย scroll, เสีย state, กระพริบทั้งหน้า |
| 4 | callback `onSuccess` → เรียก loader ซ้ำ | หลายจุด (โค้ดใหม่ๆ) | ✅ **ถูกต้องที่สุด** — เป็นแม่แบบที่ควรใช้ทั้งระบบ |
| 5 | Supabase Realtime | 4 จุด | ✅ แต่ครอบคลุมน้อยมาก (ดูข้อ 3) |

**ประเด็นที่ทำให้งง:** component ตัวเดียวกันบางที่ทำงาน บางที่ไม่ทำงาน เพราะ parent ต่างกัน — ดูตัวอย่างในข้อ 2.1

---

## 2. จุดที่มีอาการ (ไล่ทั้งระบบแล้ว)

### 2.1 🔴 รุนแรง — component ตัวเดียว ใช้ 2 ที่ ทำงานแค่ที่เดียว

`CandidateActivityLog` (`candidate-activity-log.tsx:94,118`) และ `FeedbackSection` (`feedback-section.tsx:96`) หลังบันทึกจะเรียก `router.refresh()`

| ใช้ที่ไหน | parent เป็นอะไร | ผล |
|---|---|---|
| `/requisitions/manage/candidate/[jr_candidate_id]/page.tsx:93,102` | **server component** | ✅ เห็นทันที |
| `jr-candidate-sheet.tsx:252,259` | client — ส่ง `logs`/`feedback` เป็น props จาก state ตัวเอง | ❌ **ไม่เห็นจนกว่าจะ hard refresh** |
| `HistoryTimeline.tsx:60,70` (ใน `candidate-profile-sheet`) | client | ❌ ไม่เห็น |

**นี่น่าจะเป็นเคสที่ user เจอบ่อยที่สุด** เพราะ recruiter ทำงานผ่าน sheet เป็นหลัก (คลิกชื่อจากลิสต์ → sheet เด้ง → เพิ่ม log / feedback)

### 2.2 🔴 รุนแรง — หน้า Candidate Detail (`/candidates/[id]`)

หน้านี้เป็น client component ที่ `fetch('/api/candidates/[id]')` เก็บลง `useState` แต่ทุก action รอบตัวมันใช้ `router.refresh()`:

| Action | ไฟล์ | ปัญหา |
|---|---|---|
| แก้โปรไฟล์ → save | `candidates/[id]/edit/page.tsx:15-16` | `router.replace()` + `router.refresh()` → หน้า detail ที่อยู่ใน router cache ถูก restore พร้อม state เดิม → เห็นข้อมูลเก่า |
| อัปโหลด/ลบ resume | `resume-manager.tsx:90,116` | `router.refresh()` + `onUpdate()` — แต่ `onUpdate` ที่ส่งมาจาก `candidates/[id]/page.tsx:193-197` เป็น **ฟังก์ชันว่าง** (มี comment เขียนไว้ว่า "router.refresh should handle...") |
| อัปเดต LinkedIn / checked | `candidate-linkedin-button.tsx:78` | `router.refresh()` อย่างเดียว |
| เพิ่ม/แก้/ลบ experience | `experience-dialog.tsx:423,549,570` | ไม่ได้ส่ง `onSuccess` มา → fallback เป็น `window.location.reload()` → เห็นข้อมูล แต่หน้ากระพริบทั้งหน้า |
| ลบ experience หลายรายการ | `candidates/[id]/page.tsx:386-391` | ✅ refetch เอง (ถูก) — แต่มี `fetch` ซ้ำซ้อน 1 ครั้งที่ไม่ได้ใช้ผล (บรรทัด 386) |

**5 action ในหน้าเดียว ใช้วิธี refresh 4 แบบต่างกัน**

### 2.3 🟠 ปานกลาง — cache ระดับ module ที่ไม่มีวันหมดอายุ

| ที่ไหน | ตัวแปร | อาการ |
|---|---|---|
| `jr-switcher.tsx:25` | `jrListCache` | โหลดครั้งเดียวต่อ browser session แล้ว **return ทันทีตลอด** (บรรทัด 48-55) — แก้ชื่อ JR / สร้าง JR โดยคนอื่น → dropdown ยังเป็นของเก่าจนกว่าจะ hard refresh (invalidate เฉพาะตอน `selectedId` ไม่อยู่ใน cache) |
| `requisitions/manage/page.tsx:52-53` | `jrCache`, `analyticsCache` | ดีกว่า — show cache ก่อนแล้ว fetch ทับ (stale-while-revalidate) แต่ถ้า fetch พลาดก็ค้างของเก่าเงียบๆ |

### 2.4 🟠 ปานกลาง — cross-user (5 คนทำงานพร้อมกัน)

ทุกหน้าโหลดข้อมูลตอน mount ครั้งเดียว → **ของที่คนอื่นแก้จะไม่โผล่เลยจนกว่าจะเปลี่ยนหน้าไปกลับ หรือ hard refresh**
เช่น A เพิ่ม candidate เข้า JR / เปลี่ยน status แล้ว B เปิดหน้าเดียวกันค้างไว้ → B เห็นของเก่า, B อาจแก้ทับ

Realtime ที่มีอยู่ครอบคลุมแค่:
| hook / component | ตาราง | scope |
|---|---|---|
| `use-jr-realtime.ts` | `job_requisitions` (UPDATE) | เฉพาะ JR ที่เปิดอยู่ — ไม่รวม candidate ใน JR |
| `use-chat-realtime.ts` | chat messages | AI chat |
| `org-chart-viewer(-v2).tsx` | `org_charts` | org chart |

**ไม่มี realtime สำหรับ `jr_candidates`, `status_log`, `Candidate Profile`, `candidate_experiences`** ซึ่งคือข้อมูลที่แก้กันบ่อยที่สุด
(หมายเหตุ: ต้องเช็คด้วยว่า table พวกนี้ถูกใส่ใน publication `supabase_realtime` แล้วหรือยัง ถ้ายัง hook ที่มีอยู่ก็เงียบไปเฉยๆ ไม่ error)

### 2.5 ✅ จุดที่ทำถูกอยู่แล้ว — ใช้เป็นแม่แบบ

| ไฟล์ | pattern |
|---|---|
| `internal/page.tsx:174` | `const refresh = () => { loadPeople(); loadSetupData(); }` แล้วทุก dialog ส่ง `onSuccess={() => { close(); refresh(); }}` |
| `settings/user-management.tsx:98,111` | `loadUsers()` หลัง save/delete |
| `settings/status-master-settings.tsx` | `await refreshRows()` หลังทุก mutation |
| `placement/page.tsx:65-73` | `fetchData` แยกเป็น `useCallback` + มีปุ่ม Refresh |
| `jr-candidate-sheet.tsx:61-67`, `candidate-profile-sheet.tsx:70-81` | refetch ทุกครั้งที่ sheet เปิด |
| `candidate-list.tsx` | setCandidates จากผล mutation |

**ข่าวดี: รูปแบบที่ถูกต้องมีอยู่แล้วในระบบ ไม่ต้องคิดใหม่ แค่ทำให้เหมือนกันทั้งระบบ**

---

## 3. ไอเดียแก้ — 6 ทาง

### ไอเดีย A — ทำให้ทุก mutation refetch ตัวเอง (callback pattern) ⭐ ต้องทำ
เลิกใช้ `router.refresh()` ในหน้า client แล้วเปลี่ยนเป็น `onSuccess` callback ที่ parent เป็นคนโหลดข้อมูลใหม่ — แบบเดียวกับ `/internal`

- ✅ deterministic ที่สุด แก้อาการได้ตรงจุด ไม่ต้องพึ่ง infra ใหม่
- ✅ ไม่กระทบ performance (โหลดเฉพาะตอนที่มีการเปลี่ยนจริง)
- ❌ ต้องไล่แก้ทีละจุด (~20 จุดที่เป็นปัญหาจริง)
- **ไม่ช่วยเรื่อง cross-user** (ข้อ 2.4)

### ไอเดีย B — refetch เมื่อ user กลับมาที่แท็บ (focus / visibility) ⭐ คุ้มที่สุดต่อแรง
hook ตัวเดียว `useRefreshOnFocus(loader)` — เมื่อ `window.focus` หรือ `visibilitychange` และผ่านไปเกิน ~10 วิ ให้โหลดใหม่เงียบๆ

- ✅ **เขียนครั้งเดียว ~30 บรรทัด ใส่ในหน้าหลัก 8-10 หน้าได้ทันที**
- ✅ แก้เคส cross-user ได้ ~80% — pattern จริงของ user คือสลับแท็บ/ไปทำอย่างอื่นแล้วกลับมา
- ✅ ไม่มี traffic ตอนไม่ได้ใช้งาน (ต่างจาก poll)
- ❌ ไม่ช่วยกรณีเปิดหน้าค้างจ้องอยู่เฉยๆ

### ไอเดีย C — Supabase Realtime บนตารางที่แก้บ่อย
ขยาย pattern `use-jr-realtime.ts` ไปที่ `jr_candidates`, `status_log`, `Candidate Profile`

- ✅ update แทบจะทันที เหมาะกับ 5 users มาก (ไม่มีปัญหา scale)
- ✅ โครงมีอยู่แล้ว
- ❌ ต้องเปิด publication + คิดเรื่อง RLS (ตอนนี้อ่านด้วย anon key จาก browser)
- ❌ ถ้าทำแบบ "ได้ event แล้ว refetch ทั้งก้อน" จะง่ายและปลอดภัยกว่าพยายาม merge payload เอง (hook เดิม map payload เองซึ่งเปราะ — field เพิ่มทีต้องแก้ทุกที)
- แนะนำ: ใช้เป็น **สัญญาณให้ refetch** ไม่ใช่แหล่งข้อมูล

### ไอเดีย D — Poll แบบเบาๆ (30-60 วิ) เฉพาะหน้าที่เป็น workspace
- ✅ ง่ายสุด ไม่ต้องแตะ DB config
- ✅ 5 users × 1 request/30s = ไม่มีผลกับ cost เลย
- ❌ ยัง "ไม่ทันใจ" ในความหมายที่ user ว่า และเปลืองเปล่าตอนไม่มีใครแก้อะไร
- เหมาะเป็น **safety net** คู่กับ B มากกว่าเป็นพระเอก

### ไอเดีย E — ศูนย์กลาง cache + invalidate (TanStack Query หรือ event bus เล็กๆ)
แทนที่จะให้แต่ละหน้าจัดการเอง ทำ layer กลาง: mutation เสร็จ → `invalidate('jr:JR000214')` → ทุก component ที่ subscribe key นั้นโหลดใหม่เอง

- ✅ แก้ปัญหาที่ราก — รวมทั้ง B, C, D ให้มาอยู่ที่เดียว
- ✅ ได้ dedup / loading state / retry ฟรี
- ❌ เป็นงานใหญ่ (มี client component ที่เรียก server action อยู่ **99 ไฟล์**)
- ทางสายกลาง: เขียน event bus เอง ~50 บรรทัด + hook `useRefreshableData(key, loader)` ไม่ต้องลง library ใหม่

### ไอเดีย F — ลด/แก้ module cache + ปรับ Next router cache
1. ใส่ TTL หรือ invalidate ให้ `jrListCache` (`jr-switcher.tsx`) — อย่างน้อย refetch ตอนเปิด dropdown
2. ลองตั้ง `experimental.staleTimes = { dynamic: 0, static: 0 }` ใน `next.config.ts` — หน้า client ที่ไม่มี dynamic API ถูกมองเป็น static segment (default cache 5 นาที) การกลับมาหน้าเดิมภายใน 5 นาทีจึงได้ tree เดิมพร้อม state เดิม
   → **ต้องวัดผลจริงก่อน** ถือเป็นตัวช่วย ไม่ใช่ตัวหลัก
3. ลบ `revalidatePath()` ที่ไม่มีผล หรือปล่อยไว้ก็ได้ (ไม่เสียหาย แต่ทำให้คนอ่านโค้ดเข้าใจผิดว่ามีการ refresh แล้ว)

---

## 4. แผนที่เสนอ (combo B + A + C)

| Phase | ทำอะไร | ผลที่ user รู้สึก | แรง |
|---|---|---|---|
| **1. Quick win** | • hook `useRefreshOnFocus` ใส่หน้าหลัก 8-10 หน้า<br>• แก้ `jr-switcher` ให้ refetch ตอนเปิด dropdown<br>• ใส่ปุ่ม Refresh + แสดง "อัปเดตล่าสุด HH:mm" ในหน้า workspace | สลับแท็บกลับมา = ข้อมูลใหม่, มีปุ่มกดเองได้ ไม่ต้อง hard refresh | ครึ่งวัน |
| **2. แก้จุดที่พังจริง** | เปลี่ยน `router.refresh()` → callback refetch ใน 6 ไฟล์ของข้อ 2.1-2.2 (activity log, feedback, resume, linkedin, edit→detail, experience) | ใส่ข้อมูลแล้วเห็นทันที ไม่กระพริบ | 1 วัน |
| **3. Cross-user** | Realtime บน `jr_candidates` + `status_log` (+ `Candidate Profile`) → ใช้เป็นสัญญาณ refetch + toast "มีการอัปเดตจาก [ชื่อ]" | เห็นงานของเพื่อนร่วมทีมแบบ near-realtime | 1 วัน |
| **4. เก็บกวาด (optional)** | event bus กลาง + ย้ายทีละหน้ามาใช้ · ลบ `revalidatePath` ที่ไม่มีผล | โค้ดเหลือ pattern เดียว บั๊กแบบนี้ไม่กลับมาอีก | 1-2 วัน |

**Phase 1-2 น่าจะแก้ feedback ของ user ได้เกือบทั้งหมด** ทำก่อนแล้วดูผลจริงก่อนตัดสินใจทำ 3-4

---

## 5. เรื่อง 5 concurrent users — ทำให้ตัดสินใจง่ายขึ้น

- **ไม่ต้องกลัว cost / scale เลย** — realtime 5 connections, poll ทุก 30 วิ, refetch on focus ทั้งหมดนี้คือ traffic ระดับหลักสิบ request ต่อนาที
- **ไม่ต้องทำ optimistic UI ซับซ้อน** — refetch ตรงๆ หลัง mutation เร็วพอและถูกต้องเสมอ
- **ไม่ต้องทำ conflict resolution เต็มรูปแบบ** — แค่ toast เตือน "ข้อมูลนี้ถูกอัปเดตโดย X เมื่อสักครู่" ก็พอสำหรับทีมขนาดนี้
- สิ่งที่ควรลงแรงคือ **ความสม่ำเสมอของ pattern** ไม่ใช่ความ advance ของเทคนิค

---

## 6. คำถามที่อยากให้ช่วยตอบ (เพื่อเลือกลำดับ)

1. อาการที่ user บ่นเกิดที่หน้าไหนบ่อยสุด — Candidate Detail, JR Candidate Sheet (คลิกชื่อจากลิสต์) หรือหน้าอื่น?
2. "ใส่ข้อมูล" ที่ว่าหมายถึงอะไรเป็นหลัก — แก้โปรไฟล์ candidate / เพิ่ม experience / เปลี่ยน status ใน JR / เพิ่ม activity log?
3. อยากได้แบบ "เห็นของเพื่อนร่วมทีมแบบ realtime" ด้วยมั้ย หรือแค่ "ของที่ตัวเองเพิ่งกดต้องเห็นทันที" ก็พอในรอบนี้?

---

---

## 7. Fix List — เฉพาะอาการ "กดบันทึกแล้วจอไม่เปลี่ยน" (scope ที่ยืนยันแล้ว)

ไล่ทั้งระบบแล้วแยกได้ 3 กลุ่ม เรียงตามความเจ็บของ user

### 7.1 🔴 กลุ่ม "เงียบสนิท" — toast ขึ้น แต่ไม่มีอะไรโหลดใหม่เลย

| # | อาการ | ต้นเหตุ (file:line) | วิธีแก้ |
|---|---|---|---|
| 1 | **Add / Edit Interview Feedback แล้วไม่ขึ้นในลิสต์** ← เคสที่ user ยกมา | `feedback-section.tsx:234` render `<AddFeedbackDialog>` **โดยไม่ส่ง `onSuccess`** ทั้งที่ dialog รองรับ prop นี้อยู่แล้ว (`add-feedback-dialog.tsx:37,162`) | เพิ่ม prop `onChanged` ให้ `FeedbackSection` แล้วส่งต่อเป็น `onSuccess={onChanged}` |
| 2 | ลบ feedback แล้วการ์ดยังอยู่ | `feedback-section.tsx:96` ใช้ `router.refresh()` | เรียก `onChanged()` แทน |
| 3 | **เพิ่ม / แก้ / ลบ Activity Log (status log) แล้วไม่ขึ้น** | `candidate-activity-log.tsx:94,118` ใช้ `router.refresh()` | เพิ่ม prop `onChanged` แบบเดียวกัน |
| 4 | อัปโหลด / ลบ Resume ในหน้า Candidate Detail แล้วไม่เปลี่ยน | `resume-manager.tsx:90,116` ใช้ `router.refresh()` + `candidates/[id]/page.tsx:193-197` ส่ง `onUpdate` มาเป็น **ฟังก์ชันว่าง** | ทำ `refetchCandidate()` ในหน้า detail แล้วส่งเข้า `onUpdate` |
| 5 | อัปเดต LinkedIn / ปุ่ม checked แล้ว badge ไม่เปลี่ยน | `candidate-linkedin-button.tsx:78` ใช้ `router.refresh()` | รับ `onUpdated` callback |
| 6 | แก้โปรไฟล์ในหน้า Edit → เด้งกลับหน้า Detail แล้วเห็นข้อมูลเก่า | `candidates/[id]/edit/page.tsx:15-16` ใช้ `router.replace()` + `router.refresh()` แต่หน้า detail เป็น client component ที่เก็บข้อมูลใน `useState` | ให้หน้า detail refetch ตอน mount/focus (ดู 7.3) |

**ข้อสังเกตสำคัญ:** ข้อ 1-3 พังเฉพาะตอนอยู่ใน **sheet** (ซึ่งคือทางที่ recruiter ใช้จริง) — ถ้าเปิดจากหน้า `/requisitions/manage/candidate/[jr_candidate_id]` (server component) กลับทำงานปกติ เลยเป็นอาการที่ "บางทีก็เห็น บางทีก็ไม่เห็น"

**ข่าวดีมาก:** sheet ทั้งสองตัว **มีฟังก์ชัน refetch เตรียมไว้แล้ว** แค่ยังไม่ได้ส่งลงไป
- `jr-candidate-sheet.tsx:71-73` → `handleRefresh()` (refetch แบบเงียบ ไม่มี loading กระพริบ)
- `candidate-profile-sheet.tsx:91-92` → `fetchData(candidateId, true)`

และ dialog อื่นๆ ใน sheet เดียวกัน (`AddExperienceDialog`, `EditExperienceDialog`, `DeleteExperienceButton`) **ส่ง `onSuccess={handleRefresh}` ถูกต้องอยู่แล้ว** — มีแค่ feedback กับ activity log ที่ตกหล่น
→ **แก้ 2 ไฟล์หลัก + จุดเรียกใช้อีก 3 ที่ ก็ปิดเคสที่ user บ่นได้**

### 7.2 🟠 กลุ่ม "เห็นข้อมูล แต่หน้ากระพริบทั้งจอ"

ใช้ `window.location.reload()` — ข้อมูลขึ้นจริง แต่โหลดใหม่ทั้งหน้า เสีย scroll position เสีย tab ที่เปิดค้าง ช้า และดูเหมือนระบบค้าง

| อาการ | ต้นเหตุ |
|---|---|
| เพิ่ม / แก้ / ลบ Experience ในหน้า Candidate Detail | `experience-dialog.tsx:423,549,570` (fallback เพราะ `candidates/[id]/page.tsx:398,455,456` ไม่ส่ง `onSuccess`) |
| เพิ่ม / แก้ / ลบ Pre-Screen Log | `candidate-client-actions.tsx:90,247,383` → `scrollWithReload()` (`:31-36`) |

แก้ด้วยวิธีเดียวกับ 7.1: ทำ `refetchCandidate()` ในหน้า `/candidates/[id]` แล้วส่งเป็น `onSuccess` ให้ครบทั้ง 11 จุด

### 7.3 🟡 กันพลาด — ให้หน้าโหลดข้อมูลใหม่เมื่อ user กลับมาที่หน้า/แท็บ

hook เล็กๆ `useRefreshOnFocus(loader)` (~30 บรรทัด) ใส่ในหน้าหลัก แก้ได้ทั้ง
- เคสข้อ 6 (เด้งกลับจากหน้า edit)
- เคสที่ user เปิดอีกแท็บไปแก้แล้วกลับมา
- และเป็นตาข่ายรองรับจุดที่ยังตกหล่น

### 7.4 ✅ ตัวช่วยให้ user มั่นใจว่าบันทึกแล้วจริง

ปัญหาที่ user บอกจริงๆ คือ **"ไม่รู้ว่าใส่ข้อมูลไปแล้วรึยัง"** — นอกจากทำให้ข้อมูลขึ้น ควรเพิ่มสัญญาณด้วย:
- หลังบันทึก ให้ข้อมูลใหม่ **highlight ชั่วครู่** (เช่นพื้นหลังเหลืองจางๆ 2 วิ) — ตาจับได้ทันทีว่าอันไหนเพิ่งเพิ่ม
- toast เปลี่ยนจาก "Feedback submitted successfully!" เป็นข้อความที่อ้างอิงของจริง เช่น `บันทึก feedback ของ [ชื่อผู้สัมภาษณ์] แล้ว`
- ระหว่างรอ refetch ให้ปุ่ม/การ์ดอยู่ในสถานะ loading แทนที่จะปิด dialog ทันที — user จะไม่เห็นช่วง "ว่างเปล่า" ที่ทำให้สงสัยว่าหายไปไหน

### 7.5 ลำดับที่เสนอ

| ลำดับ | ทำอะไร | แรง |
|---|---|---|
| **1** | 7.1 ข้อ 1-3 (feedback + activity log ใน sheet) — ตรงกับที่ user บ่น | ~2 ชม. |
| **2** | 7.1 ข้อ 4-5 + 7.2 (หน้า Candidate Detail ทั้งหน้า ให้ใช้ refetch แทน reload) | ครึ่งวัน |
| **3** | 7.3 hook + 7.4 highlight/toast | ครึ่งวัน |

Realtime (ข้อ 3 ไอเดีย C) และ event bus กลาง (ไอเดีย E) **พักไว้ก่อน** — ไม่เกี่ยวกับอาการที่ user เจอ

---

*Created: 2026-09-16 | Data Freshness Survey v2 — narrowed to own-write visibility (ยังไม่ implement)*
