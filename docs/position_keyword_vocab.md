# Position Keyword Vocabulary

> **สร้างครั้งแรก:** April 2026  
> **ข้อมูลอ้างอิง:** top 200 distinct positions จาก `candidate_experiences` (37,614 rows, 21,981 distinct values)  
> **วัตถุประสงค์:** เป็น controlled vocabulary สำหรับ `position_keyword` column เพื่อให้ Preliminary AI สามารถ map ชื่อตำแหน่งได้อย่างแม่นยำ

---

## หลักการออกแบบ (Design Principles)

1. **ยึดจาก recruiter's perspective** — ค่าใน vocab ควรตรงกับสิ่งที่ recruiter จะพิมพ์ค้นหา ไม่ใช่ตรง title บน LinkedIn
2. **ไม่ละเอียดเกินไป** — `"Hotel General Manager"` และ `"Resort General Manager"` → รวมเป็น `"General Manager"` เพราะ recruiter ค้นหา GM ไม่ได้แยก property type
3. **ไม่หยาบเกินไป** — `"CFO"` และ `"CEO"` ต้องแยกกัน ค้นหาคนละแบบ
4. **Abbreviation + Full name รวมกัน** — เก็บทั้งสองรูปแบบไว้ใน field เดียว เช่น `"CEO / Chief Executive Officer"` เพื่อให้ ILIKE ค้นได้ทั้งคู่
5. **NULL = ไม่รู้จักจริงๆ** — ถ้า map ไม่ได้ ปล่อย NULL ดีกว่า map ผิด

---

## Vocab List

### กลุ่ม C-Suite & Executive Leadership

| position_keyword | ครอบคลุม raw titles ตัวอย่าง | เหตุผล |
|---|---|---|
| `CEO / Chief Executive Officer` | CEO, Chief Executive Officer, President & CEO, Group CEO, Deputy CEO | รวม Group/Deputy ด้วยเพราะ recruiter มักหา CEO ทั้งหมด |
| `CFO / Chief Financial Officer` | CFO, Chief Financial Officer, Group CFO, Group Chief Financial Officer | เหมือนกัน |
| `COO / Chief Operating Officer` | COO, Chief Operating Officer, Chief Operations Officer | ใช้ได้สองแบบ |
| `CTO / Chief Technology Officer` | CTO, Chief Technology Officer, VP of Engineering, Head of Engineering | รวม tech leadership เพราะ recruiter ค้นหาใกล้เคียงกัน |
| `CMO / Chief Marketing Officer` | CMO, Chief Marketing Officer | |
| `CHRO / Chief HR Officer` | Chief Human Resources Officer, Chief People Officer | |
| `CCO / Chief Commercial Officer` | Chief Commercial Officer, CCO | |
| `CDO / Chief Data Officer` | Chief Data Officer | |
| `CIO / Chief Information Officer` | Chief Information Officer | |
| `CSO / Chief Strategy Officer` | Chief Strategy Officer, CSO | |
| `CMercO / Chief Merchandising Officer` | Chief Merchandising Officer | เฉพาะ Retail |
| `Managing Director` | Managing Director, MD, Deputy Managing Director, Assistant Managing Director | MD มักใช้แทน CEO ใน SEA |
| `Chairman / Board Member` | Chairman, Chairwoman, Board Member, Member Board of Directors, Non Executive Director, Advisory Board Member, Independent Director | รวม board-level ทั้งหมด เพราะ recruiter ไม่ค่อยแยก |
| `Founder / Co-Founder` | Founder, Co-Founder, Business Owner, Owner | |
| `President` | President (ที่ไม่ใช่ VP) | ระวัง overlap กับ VP |

---

### กลุ่ม General Management

| position_keyword | ครอบคลุม raw titles ตัวอย่าง | เหตุผล |
|---|---|---|
| `General Manager` | General Manager, GM, Hotel General Manager, Resort Manager, Hotel Manager, Cluster General Manager, Area General Manager, Group General Manager, Store General Manager, Brand General Manager, Interim General Manager, Acting General Manager | GM คือตำแหน่งที่ค้นหาบ่อยที่สุด (2,117 rows) รวม scope variants ทั้งหมด |
| `Country Manager` | Country Manager, Regional Manager, Area Manager | P&L ระดับประเทศ/ภูมิภาค |
| `Deputy General Manager` | Deputy General Manager, Assistant General Manager, Resident Manager, Executive Assistant Manager | รองลงมาจาก GM โดยตรง |

---

### กลุ่ม Hospitality (Hotel-specific)

| position_keyword | ครอบคลุม raw titles ตัวอย่าง | เหตุผล |
|---|---|---|
| `Director of Rooms` | Director of Rooms, Rooms Division Manager, Room Division Manager | hotel-specific |
| `Front Office Manager` | Front Office Manager, Assistant Front Office Manager | |
| `F&B Manager` | Food and Beverage Manager, Director of Food and Beverage, Director of Food & Beverage, Restaurant Manager | รวม F&B director ด้วย |
| `Executive Chef` | Executive Chef | |
| `Revenue Manager` | Revenue Manager, Director of Revenue Management, Cluster Director of Revenue Management | |
| `EAM` | EAM, Executive Assistant Manager | ตำแหน่ง hotel-specific |
| `Guest Services Manager` | Guest Services Manager, Duty Manager | |

---

### กลุ่ม Sales & Commercial

| position_keyword | ครอบคลุม raw titles ตัวอย่าง | เหตุผล |
|---|---|---|
| `Sales Director` | Sales Director, Director of Sales, Commercial Director | |
| `DOSM / Director of Sales & Marketing` | Director of Sales & Marketing, Director of Sales and Marketing, Cluster Director of Sales & Marketing | hotel term แต่พบบ่อยมาก |
| `Sales Manager` | Sales Manager, Senior Sales Manager, Key Account Manager, Account Manager | |
| `Business Development Director` | Business Development Director, Director of Business Development | |
| `Business Development Manager` | Business Development Manager, Senior Business Development Manager | |

---

### กลุ่ม Marketing

| position_keyword | ครอบคลุม raw titles ตัวอย่าง | เหตุผล |
|---|---|---|
| `Marketing Director` | Marketing Director, Director of Marketing, Commercial Director (marketing focus) | |
| `Marketing Manager` | Marketing Manager, Senior Marketing Manager, Brand Manager, Senior Brand Manager | |
| `Brand Director` | Brand Director, Brand General Manager | |

---

### กลุ่ม HR

| position_keyword | ครอบคลุม raw titles ตัวอย่าง | เหตุผล |
|---|---|---|
| `HR Director` | HR Director, Human Resources Director, Head of Human Resources, Head Of Human Resources | |
| `HR Manager` | HR Manager, Human Resources Manager, Vice President Human Resources | |

---

### กลุ่ม Finance

| position_keyword | ครอบคลุม raw titles ตัวอย่าง | เหตุผล |
|---|---|---|
| `Finance Director` | Finance Director, Financial Director, Director of Finance | |
| `Finance Manager` | Finance Manager, Financial Controller, Group Financial Controller, Internal Audit Manager | |

---

### กลุ่ม Operations

| position_keyword | ครอบคลุม raw titles ตัวอย่าง | เหตุผล |
|---|---|---|
| `Operations Director` | Operations Director, Director of Operations, Director Of Operations | |
| `Operations Manager` | Operations Manager, Head of Operations | |
| `Project Manager` | Project Manager, Senior Project Manager, Project Leader | |
| `Project Director` | Project Director | |

---

### กลุ่ม Technology

| position_keyword | ครอบคลุม raw titles ตัวอย่าง | เหตุผล |
|---|---|---|
| `Software Engineer` | Software Engineer, Senior Software Engineer | |
| `Data Scientist` | Data Scientist | |
| `Architect` | Architect, Senior Architect | software/solution architect |

---

### กลุ่ม Retail & Merchandising

| position_keyword | ครอบคลุม raw titles ตัวอย่าง | เหตุผล |
|---|---|---|
| `Retail Director` | Retail Director, Buying Director | |
| `Store Manager` | Store Manager, Branch Manager, Retail Manager | |
| `Buying Manager` | Buying Manager, Category Manager, Merchandise Manager, Buyer, Senior Buyer | |

---

### กลุ่ม Consulting & Advisory

| position_keyword | ครอบคลุม raw titles ตัวอย่าง | เหตุผล |
|---|---|---|
| `Partner / Principal` | Partner, Managing Partner, Associate Partner, Principal | consulting firm level |
| `Consultant` | Consultant, Senior Consultant, Management Consultant, Advisor, Senior Advisor | |
| `Associate` | Associate, Senior Associate, Summer Associate | entry-level consulting |

---

### กลุ่ม Legal

| position_keyword | ครอบคลุม raw titles ตัวอย่าง | เหตุผล |
|---|---|---|
| `Legal Director / General Counsel` | Legal Director, Legal Counsel, Head of Legal, General Counsel | |
| `Legal Manager` | Legal Manager, Lawyer, Counsel | |

---

### กลุ่ม VP / Senior Leadership (ไม่ specific function)

| position_keyword | ครอบคลุม raw titles ตัวอย่าง | เหตุผล |
|---|---|---|
| `Vice President` | Vice President, SVP, EVP, AVP, Senior Vice President, Executive Vice President, Assistant Vice President | รวม VP ทั่วไปที่ไม่ระบุ function |

---

### กลุ่ม Director (ไม่ specific function)

| position_keyword | ครอบคลุม raw titles ตัวอย่าง | เหตุผล |
|---|---|---|
| `Director` | Director, Executive Director, Senior Director, Associate Director, Non Executive Director, Regional Director, Deputy Director | Director ทั่วไปที่ไม่ระบุ function |

---

### กลุ่ม Manager (ไม่ specific function)

| position_keyword | ครอบคลุม raw titles ตัวอย่าง | เหตุผล |
|---|---|---|
| `Manager` | Manager, Senior Manager, Assistant Manager | generic manager ที่ระบุ function ไม่ได้ |

---

## ค่า NULL — ไม่ต้อง map

ค่าเหล่านี้ควรปล่อย position_keyword เป็น NULL:

- `No Experience Data Found`
- `N/A`
- `Intern`, `Management Trainee`, `Internship`
- `Member` (คลุมเครือเกินไป)

---

## สถิติเบื้องต้น (April 2026)

- distinct positions ทั้งหมด: **21,981**
- rows ที่ต้อง map: **37,614**
- vocab size ปัจจุบัน: **~55 ค่า**
- คาดว่าครอบคลุม top positions ได้: **~60-70% ของ rows**
- Long tail (appear 1 ครั้ง): ยอมรับ NULL

---

## วิธี Iterate ในอนาคต (1-3 เดือน)

1. **ดู query ที่ fail** — ถ้า Preliminary AI generate `position_keyword` แล้วหาคนไม่เจอ แปลว่า vocab ขาดค่านั้น
2. **ดู NULL ที่เยอะผิดปกติ** — query `WHERE position_keyword IS NULL GROUP BY position ORDER BY count DESC` แล้วเพิ่ม mapping
3. **ดู recruiter feedback** — ถ้าค้นหา "F&B Manager" แล้วได้น้อยเกินไป อาจต้องแยก Director of F&B ออกมาเป็น keyword ต่างหาก
4. **อย่าลบค่าเก่า** — เพิ่มค่าใหม่หรือ remap เท่านั้น เพราะการลบจะทำให้ข้อมูลที่ map ไปแล้วหาย

---

*ร่างโดย Claude AI | อ้างอิงข้อมูล DB จริง top 200 positions | April 2026*
