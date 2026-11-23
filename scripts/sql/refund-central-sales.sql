-- พนักงานขายส่วนกลาง (role sales_central, บัญชีใช้ร่วมกันหลายคน ไม่ผูกร้าน)
-- ผู้ขอกรอกชื่อ / ชื่อเล่น / อีเมล / เบอร์ / หน่วยงานเองทุกครั้ง -> เก็บในคำขอ (requester_unit มีอยู่แล้ว)
-- คำขอของพนักงานในร้านเดิมไม่มีค่าในคอลัมน์เหล่านี้ (ดึงจาก sale_reps ตาม rep_code เหมือนเดิม)
alter table public.refund_requests
  add column if not exists requester_name text,
  add column if not exists requester_nickname text,
  add column if not exists requester_email text,
  add column if not exists requester_phone text;
