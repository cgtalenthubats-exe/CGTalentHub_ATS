-- 20260326_add_batch_name_to_logs.sql
-- Add batch_name column to csv_upload_logs to store imported file name

-- 1. เพิ่มคอลัมน์ batch_name เพื่อเก็บชื่อไฟล์
ALTER TABLE csv_upload_logs ADD COLUMN IF NOT EXISTS batch_name TEXT;

-- 2. อัปเดตข้อมูลเก่าให้แสดงเป็น Batch No. ตามด้วย 8 ตัวแรกของ ID
UPDATE csv_upload_logs 
SET batch_name = 'Batch No. ' || substring(batch_id::text from 1 for 8) 
WHERE batch_name IS NULL;
