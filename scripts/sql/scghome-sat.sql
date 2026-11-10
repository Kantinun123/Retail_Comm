-- ความพึงพอใจลูกค้า: แบบสอบถาม "สินค้าและร้าน" ของ SCG Home (Google Sheet แยก)
-- เก็บแยกจาก cust_sat_lines (แบบสอบถามงานบริการ) เพื่อไม่ให้คะแนนสองแบบสอบถามปนกัน
-- ไม่เก็บชื่อ/เบอร์ลูกค้า และชื่อพนักงานที่ลูกค้าระบุ
create table if not exists public.scghome_sat_lines (
  id             bigint generated always as identity primary key,
  case_no        text not null unique,
  eval_date      date not null,
  period         text not null,
  dealer_code    text references public.dealers(code) on update cascade on delete set null,
  store_name     text,
  region         text,
  product_group  text,
  reason         text,
  used_other     text,
  other_store    text,
  q_variety      numeric,
  q_quality      numeric,
  q_availability numeric,
  q_price        numeric,
  q_promotion    numeric,
  q_display      numeric,
  q_staff        numeric,
  q_payment      numeric,
  q_delivery     numeric,
  overall        numeric,
  q_revisit      numeric,
  impress_text   text,
  improve_text   text,
  source_file    text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_scghome_sat_dealer_period on public.scghome_sat_lines (dealer_code, period);
create index if not exists idx_scghome_sat_period on public.scghome_sat_lines (period);
alter table public.scghome_sat_lines enable row level security;
-- ไม่มี policy = อ่าน/เขียนผ่าน service_role (route handler) เท่านั้น
revoke all on public.scghome_sat_lines from anon, authenticated;
