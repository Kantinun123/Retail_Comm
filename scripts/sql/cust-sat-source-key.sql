-- Cust Sat: คีย์สำหรับ sync จาก Google Sheet (แบบสอบถามงานบริการ ตั้งแต่ 1 ต.ค. 2026)
-- source_key = "<วันที่>T<เวลาที่ตอบ>|<ชื่อสาขา>" (Sheet ไม่มีรหัสคำตอบ)
-- แถวเดิมจากไฟล์ xlsx (sheet DATA) มี source_key = null และไม่ถูก sync แตะ
-- ใช้ unique index แบบเต็ม (ไม่ใช่ partial) เพื่อให้ upsert onConflict ใช้ได้ ; NULL หลายแถวได้ตามปกติของ Postgres
alter table public.cust_sat_lines add column if not exists source_key text;
drop index if exists public.uq_cust_sat_source_key;
create unique index uq_cust_sat_source_key on public.cust_sat_lines (source_key);
