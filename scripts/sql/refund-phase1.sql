-- แบบฟอร์มขอคืนเงินลูกค้า (กรณีลูกค้าจ่ายเงินตรง SCG) — เฟส 1: ตาราง + เลขที่ + bucket (23 พ.ย. 69)
-- ทุกตาราง RLS เปิด ไม่มี policy = อ่าน/เขียนผ่าน API (service_role) เท่านั้น ; API ตรวจสิทธิ์ด้วย getAuthContext
-- บทบาทใน profiles.role: finance (Finance 3 คน), accounting (บัญชี), refund_approver (ผู้อนุมัติ Metal Roof / Smart Solution)

-- ผู้อนุมัติตามกลุ่มงาน (roof = Area ของร้าน จาก rep_store_assignments ; metal / smart = คนเดียวตามตารางนี้)
create table if not exists public.refund_approvers (
  job_group text primary key check (job_group in ('metal', 'smart')),
  profile_id uuid not null references public.profiles(id),
  title text,
  updated_at timestamptz not null default now()
);

create table if not exists public.refund_counters (period text primary key, n int not null default 0);

create table if not exists public.refund_requests (
  id bigserial primary key,
  req_no text not null unique,
  is_test boolean not null default false,
  status text not null default 'pending_approval' check (status in (
    'pending_approval', 'returned', 'finance_returned', 'pending_finance', 'finance_working',
    'pending_transfer', 'transferred', 'closed', 'rejected', 'cancelled')),
  round int not null default 1,
  refund_type text not null check (refund_type in ('wht', 'full', 'partial')),
  job_group text not null check (job_group in ('roof', 'metal', 'smart')),
  -- ผู้ขอ
  requester_id uuid not null references public.profiles(id),
  rep_code text,
  dealer_code text,
  requester_unit text,
  -- งาน
  project_no text not null,
  so_no text,
  receipt_no text,
  project_name text,
  -- ลูกค้า
  cust_type text not null check (cust_type in ('company', 'person')),
  cust_name text not null,
  cust_tax_id text not null check (cust_tax_id ~ '^\d{13}$'),
  cust_branch text,
  cust_phone text,
  -- ยอดเงิน
  paid_amount numeric(14,2) not null check (paid_amount > 0),
  wht_base numeric(14,2),
  wht_rate numeric(5,2),
  refund_amount numeric(14,2) not null check (refund_amount > 0 and refund_amount <= paid_amount),
  cancel_detail text,
  reason text,
  -- บัญชีรับเงินคืน (ข้อมูลอ่อนไหว: API ส่งให้เฉพาะผู้เกี่ยวข้อง)
  bank_name text not null,
  bank_account_no text not null,
  bank_account_name text not null,
  -- เอกสารตัวจริง
  customer_sends_direct boolean not null default false,
  parcel_carrier text,
  parcel_tracking text,
  parcel_sent_at timestamptz,
  docs_received_at timestamptz,
  -- ผู้รับผิดชอบ
  approver_id uuid references public.profiles(id),
  approved_at timestamptz,
  finance_id uuid references public.profiles(id),
  finance_claimed_at timestamptz,
  finance_done_at timestamptz,
  finance_note text,
  finance_issue jsonb,
  transfer_date date,
  customer_informed_at timestamptz,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint refund_wht_company check (refund_type <> 'wht' or cust_type = 'company'),
  constraint refund_roof_so check (job_group <> 'roof' or coalesce(so_no, '') <> '')
);
create index if not exists refund_requests_status_idx on public.refund_requests (status);
create index if not exists refund_requests_requester_idx on public.refund_requests (requester_id);
create index if not exists refund_requests_approver_idx on public.refund_requests (approver_id);
create index if not exists refund_requests_finance_idx on public.refund_requests (finance_id);

-- ไฟล์แนบ: เอกสารตามประเภทคำขอ (wht_cert, company_cert, id_card, bookbank, slip, receipt)
-- + revised_receipt (บัญชีแนบใบเสร็จ/ใบกำกับภาษีฉบับแก้ไข) ; round = รอบของคำขอตอนแนบ
create table if not exists public.refund_files (
  id bigserial primary key,
  request_id bigint not null references public.refund_requests(id) on delete cascade,
  kind text not null check (kind in ('wht_cert', 'company_cert', 'id_card', 'bookbank', 'slip', 'receipt', 'revised_receipt', 'other')),
  round int not null default 1,
  path text not null unique,
  name text not null,
  size bigint,
  mime text,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists refund_files_request_idx on public.refund_files (request_id);

create table if not exists public.refund_events (
  id bigserial primary key,
  request_id bigint not null references public.refund_requests(id) on delete cascade,
  at timestamptz not null default now(),
  actor_id uuid references public.profiles(id),
  actor_name text,
  kind text not null,
  text text,
  tone text,
  data jsonb
);
create index if not exists refund_events_request_idx on public.refund_events (request_id, at);

alter table public.refund_approvers enable row level security;
alter table public.refund_counters enable row level security;
alter table public.refund_requests enable row level security;
alter table public.refund_files enable row level security;
alter table public.refund_events enable row level security;

create or replace function public.refund_next_no()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  p text := to_char(now() at time zone 'Asia/Bangkok', 'YYMM');
  v int;
begin
  insert into public.refund_counters (period, n) values (p, 1)
  on conflict (period) do update set n = public.refund_counters.n + 1
  returning n into v;
  return 'RF-' || p || '-' || lpad(v::text, 4, '0');
end;
$$;
revoke execute on function public.refund_next_no() from public, anon, authenticated;
grant execute on function public.refund_next_no() to service_role;

-- เอกสารคืนเงิน (ส่วนตัว: เปิดผ่าน signed URL จาก API เท่านั้น) — 10MB ต่อไฟล์
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('refund-files', 'refund-files', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do nothing;
