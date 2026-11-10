# Job Function-only mode (Job Grouping hidden) — Rules & Change Log

> ช่วงทดลอง (เริ่ม 2026-10-26): user ไม่ต้องการใช้ Job Grouping (`job_grouping`) แล้ว ใช้ Job Function อย่างเดียว
> **DB ไม่เปลี่ยน** — `Candidate Profile.job_grouping` / `job_function`, `job_function_master`, view `vw_candidate_job_grouping_distribution`, RPC พารามิเตอร์ `p_job_groupings` ยังอยู่ครบ

## สวิตช์เดียว
`SHOW_JOB_GROUPING` ใน `src/lib/job-function-utils.ts` (ตอนนี้ `false`)
เปลี่ยนเป็น `true` = UI ของ Job Grouping กลับมาทุกที่ ไม่ต้องแก้ที่อื่น

## กติกาข้อมูล
- ชื่อ function **ไม่ซ้ำข้าม grouping** (144 function / 32 grouping) → รู้ grouping จาก function ได้เสมอ
- เมื่อ user เลือก/เปลี่ยน job_function ที่มีอยู่แล้ว ระบบเขียน `job_grouping` ให้อัตโนมัติ (`groupingForFunction()`) เพื่อให้ DB ครบเหมือนเดิม
- เพิ่ม function **ใหม่**: user ต้องเลือก grouping ก่อน (dropdown "Group for new function…") เพราะต้องใช้สร้างรหัสใน `job_function_master` (`addJobFunctionOption`)
- ฟอร์ม `candidate-edit-form.tsx`: ส่วน "add new function" อยู่เป็น footer ใต้รายการ (ไม่ใช่ใน `CommandEmpty`) เพราะ cmdk fuzzy-search ของรายการรวม 144 ตัวแทบไม่เคย "ไม่เจออะไรเลย" → `CommandEmpty` ไม่แสดง ทำให้เพิ่มชื่อใหม่ไม่ได้; footer จะแสดงเมื่อชื่อที่พิมพ์ไม่ตรงกับ function ที่มีอยู่เป๊ะ
- ค่าที่เก็บเป็น label รูปแบบ `ชื่อ (CODE)` ทั้ง grouping และ function

## ที่ซ่อนเมื่อ `SHOW_JOB_GROUPING=false`
| ที่ | สิ่งที่เปลี่ยน |
|---|---|
| `candidate-edit-form.tsx` | ซ่อนช่อง Job Grouping; Job Function เป็นรายการรวมทุก function (ค้นหาได้) |
| `candidate-quick-edit-bar.tsx` | เหมือนกัน |
| Dashboard → Candidate Funnel (`CandidateFunnelTab.tsx`) | ซ่อน filter "Job Family" และการ์ด "By Job Family" (เหลือ 2 การ์ด) |
| Candidates list (`candidates/list/page.tsx`, `table-view.tsx`) | ซ่อน filter "Job Group", badge กลุ่ม, หัวคอลัมน์เป็น "Job Function" |
| Recruiter details (`dashboard/recruiter/details/page.tsx`) | ซ่อน badge กลุ่ม |
| Package Info (`PackageInfoTab.tsx`) | ซ่อนคอลัมน์ Job Grouping |
| Salary benchmark (`benchmark-filters.tsx`) | ซ่อน filter Job Grouping |
| Overview (`OverviewAnalytics.tsx`) | ซ่อนกราฟ "Job Group" |
| Pending Tasks (`pending-tasks/DistributionAnalytics.tsx`) | ซ่อนกราฟ "Job Grouping Distribution" |

## ไม่ได้แตะ (ตั้งใจ)
- RPC/API/actions ที่รับ `job_groupings` (`candidate-population.ts`, `jr-candidates.ts`, `api/candidates/*`) — ไม่เลือก filter = ส่งอาร์เรย์ว่าง = ไม่กรอง (`cardinality(p_job_groupings)=0` ใน `get_candidate_population_data_v2`; `IS NULL` ใน `search_candidates_robust`)
- `FunnelCandidateListSection.tsx` ข้อความ "Job Grouping filter isn't carried over" — จะไม่แสดงเพราะ filter ถูกซ่อน
- ชื่อสับสน: ใน Funnel ป้าย "Job Family" = job_grouping แต่ใน Overview ป้าย "Job Family" = job_function (กราฟ `jobFuncDist`) — ยังไม่ได้เปลี่ยนชื่อ

## Change Log
- 2026-10-26: เพิ่มสวิตช์ + ซ่อน UI ตามตารางด้านบน, auto-derive job_grouping จาก function

*Last updated: 2026-10-26*
