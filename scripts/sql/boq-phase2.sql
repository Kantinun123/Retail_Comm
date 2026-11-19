-- BOQ สินค้า DECAAR (เฟส 2-3) : ตาราง + bucket ไฟล์ + เลขที่คำขอ
-- ทุกตาราง RLS เปิด ไม่มี policy = อ่าน/เขียนผ่าน API (service_role) เท่านั้น ; API ตรวจสิทธิ์ด้วย getAuthContext

create table if not exists public.boq_product_lines (
  code text primary key,
  name text not null,
  is_active boolean not null default true
);
insert into public.boq_product_lines (code, name) values ('decaar', 'DECAAR') on conflict do nothing;

create table if not exists public.boq_products (
  code text primary key,                 -- รหัสสินค้า S4
  line text not null references public.boq_product_lines(code),
  r3 text,
  name text not null,
  grp text,
  sub text,
  size text,
  unit text not null check (unit in ('m', 'area')),  -- m = ความยาว (เมตร), area = กว้าง x ยาว
  is_active boolean not null default true,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists boq_products_line_idx on public.boq_products (line, is_active, sort);

-- วันหยุด (ไม่นับเป็นวันทำการของ SLA) — admin เพิ่ม/ลบได้
create table if not exists public.business_holidays (
  day date primary key,
  name text not null
);

create table if not exists public.boq_loss_reasons (
  code text primary key,
  label text not null,
  sort int not null default 0,
  is_active boolean not null default true
);
insert into public.boq_loss_reasons (code, label, sort) values
  ('compare_only', 'Lost - ลูกค้าต้องการเปรียบเทียบราคาเท่านั้น', 1),
  ('undecided', 'Lost - ลูกค้ายังไม่ตัดสินใจ รอพิจารณา', 2),
  ('no_plan', 'Lost - ลูกค้ายังไม่มีแผนต่อเติมในช่วงนี้', 3),
  ('price_scg_other_store', 'Lost - ราคาสูง ซื้อสินค้า SCG ที่ร้านอื่น', 4),
  ('price_other_brand', 'Lost - ราคาสูง เปลี่ยนไปใช้สินค้ายี่ห้ออื่น', 5),
  ('stock_scg_other_store', 'Lost - สินค้าไม่พร้อมขาย ซื้อสินค้า SCG ที่ร้านอื่น', 6),
  ('stock_other_brand', 'Lost - สินค้าไม่พร้อมขาย เปลี่ยนไปใช้สินค้ายี่ห้ออื่น', 7),
  ('not_match', 'Lost - ไม่ตรงกับความต้องการลูกค้า', 8),
  ('other', 'อื่นๆ (ระบุ)', 99)
on conflict do nothing;

create table if not exists public.boq_counters (
  period text primary key,   -- YYMM (ค.ศ.)
  n int not null default 0
);

create table if not exists public.boq_requests (
  id bigserial primary key,
  req_no text not null unique,
  line text not null default 'decaar' references public.boq_product_lines(code),
  dealer_code text not null,
  rep_code text not null,
  created_by uuid not null,
  recorder_name text,
  recorder_email text,
  customer_name text not null,
  customer_phone text,
  province text,
  customer_type text not null,
  customer_type_other text,
  job_type text not null,
  building_type text not null,
  need text not null check (need in ('boq', 'boq_3d')),
  budget numeric not null,
  want_date date,
  note text,
  op_no text,
  status text not null default 'waiting'
    check (status in ('waiting', 'working', 'submitted', 'revise', 'boq_ok', 'quoted', 'win', 'loss', 'cancelled')),
  designer_id uuid,
  claimed_at timestamptz,
  due_at timestamptz not null,
  approved_version int,
  boq_ok_at timestamptz,
  final_amount numeric,
  loss_reason text references public.boq_loss_reasons(code),
  result_note text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists boq_requests_status_idx on public.boq_requests (status, created_at desc);
create index if not exists boq_requests_rep_idx on public.boq_requests (rep_code, created_at desc);
create index if not exists boq_requests_dealer_idx on public.boq_requests (dealer_code, created_at desc);
create index if not exists boq_requests_designer_idx on public.boq_requests (designer_id, status);

create table if not exists public.boq_points (
  id bigserial primary key,
  request_id bigint not null references public.boq_requests(id) on delete cascade,
  no int not null,
  product_code text not null references public.boq_products(code),
  length numeric,
  width numeric,
  detail text,
  unique (request_id, no)
);

create table if not exists public.boq_files (
  id bigserial primary key,
  request_id bigint not null references public.boq_requests(id) on delete cascade,
  kind text not null check (kind in ('photo', 'plan', 'old_design', 'boq', 'd3')),
  version int,                 -- boq / d3 = เวอร์ชันที่ส่ง
  path text not null unique,   -- ใน bucket boq-files
  name text not null,
  size bigint,
  mime text,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists boq_files_req_idx on public.boq_files (request_id, kind, version);

create table if not exists public.boq_versions (
  request_id bigint not null references public.boq_requests(id) on delete cascade,
  v int not null,
  note text,
  submitted_by uuid not null,
  submitted_at timestamptz not null default now(),
  primary key (request_id, v)
);

create table if not exists public.boq_quotes (
  id bigserial primary key,
  request_id bigint not null references public.boq_requests(id) on delete cascade,
  quote_no text not null,
  amount numeric not null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists boq_quotes_req_idx on public.boq_quotes (request_id, created_at);

create table if not exists public.boq_events (
  id bigserial primary key,
  request_id bigint not null references public.boq_requests(id) on delete cascade,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_name text,
  kind text not null,
  text text not null,
  tone text check (tone in ('warn', 'ok', 'bad'))
);
create index if not exists boq_events_req_idx on public.boq_events (request_id, at);

alter table public.boq_product_lines enable row level security;
alter table public.boq_products enable row level security;
alter table public.business_holidays enable row level security;
alter table public.boq_loss_reasons enable row level security;
alter table public.boq_counters enable row level security;
alter table public.boq_requests enable row level security;
alter table public.boq_points enable row level security;
alter table public.boq_files enable row level security;
alter table public.boq_versions enable row level security;
alter table public.boq_quotes enable row level security;
alter table public.boq_events enable row level security;

-- เลขที่คำขอ BOQ-YYMM-NNNN (เวลาไทย) — นับต่อเดือน, atomic
create or replace function public.boq_next_no()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  p text := to_char(now() at time zone 'Asia/Bangkok', 'YYMM');
  v int;
begin
  insert into public.boq_counters (period, n) values (p, 1)
  on conflict (period) do update set n = public.boq_counters.n + 1
  returning n into v;
  return 'BOQ-' || p || '-' || lpad(v::text, 4, '0');
end;
$$;
revoke execute on function public.boq_next_no() from public, anon, authenticated;
grant execute on function public.boq_next_no() to service_role;

-- ไฟล์ BOQ (ส่วนตัว: เปิดผ่าน signed URL จาก API เท่านั้น) — 50MB
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('boq-files', 'boq-files', false, 52428800, array[
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
  'application/zip', 'application/x-zip-compressed', 'application/octet-stream', 'application/vnd.sketchup.skp'
])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- (19 พ.ย. 69) ไฟล์แนบตอนแจ้งแก้ / แก้คำขอ + เก็บจุดก่อน/หลังแก้
alter table public.boq_files drop constraint boq_files_kind_check;
alter table public.boq_files add constraint boq_files_kind_check check (kind in ('photo', 'plan', 'old_design', 'boq', 'd3', 'revise'));
alter table public.boq_events add column if not exists data jsonb;
-- (19 พ.ย. 69) เหตุผล Win (เลือกได้สูงสุด 3 ข้อ ไม่มี "อื่นๆ") + ความเห็นใช้ result_note
create table if not exists public.boq_win_reasons (code text primary key, label text not null, sort int not null default 0, is_active boolean not null default true);
alter table public.boq_win_reasons enable row level security;
-- seed: price_value, quality_brand, boq_3d, service_speed, promotion, contractor, stock_ready (ดู migration boq_win_reasons)
alter table public.boq_requests add column if not exists win_reasons text[];