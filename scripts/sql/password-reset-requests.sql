-- คำขอรีเซ็ตรหัสผ่านจากร้านค้า (ส่งโดยไม่ต้อง login) -> admin ดำเนินการที่ /app/admin-users
-- เข้าถึงผ่าน service_role เท่านั้น (RLS เปิด ไม่มี policy)
create table if not exists public.password_reset_requests (
  id           bigint generated always as identity primary key,
  dealer_code  text not null references public.dealers(code) on update cascade on delete cascade,
  contact_name text not null check (char_length(contact_name) between 1 and 100),
  phone        text not null check (char_length(phone) between 1 and 30),
  note         text check (note is null or char_length(note) <= 300),
  status       text not null default 'pending' check (status in ('pending','done','dismissed')),
  created_at   timestamptz not null default now(),
  handled_by   uuid references auth.users(id) on delete set null,
  handled_at   timestamptz
);
alter table public.password_reset_requests enable row level security;
revoke all on public.password_reset_requests from anon, authenticated;
-- ร้านละ 1 คำขอที่ยังค้าง (กันส่งซ้ำท่วม)
create unique index if not exists password_reset_one_pending_per_dealer
  on public.password_reset_requests (dealer_code) where status = 'pending';
