-- Auth รอบ 1: Microsoft (Azure) login + คำเชิญ (user_invites)
-- - profiles.rep_code : ผูก Area/Coach กับ sale_reps.rep_code (emp_id FK ไป employees เดิม จึงใช้ไม่ได้)
-- - user_invites      : admin เชิญอีเมล @scg.com ล่วงหน้า -> login ครั้งแรกได้ role ทันที
-- - handle_new_user   : ใช้คำเชิญเฉพาะ provider=azure (กัน email/password สมัครด้วยอีเมลคนอื่นแล้วแย่งสิทธิ์)

alter table public.profiles add column if not exists rep_code text;

create table if not exists public.user_invites (
  email      text primary key check (email = lower(email)),
  role       text not null check (role in ('admin','area','dealer','sales','staff','re')),
  rep_code   text,
  full_name  text,
  note       text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  used_at    timestamptz
);
alter table public.user_invites enable row level security;
-- ไม่มี policy = เข้าถึงผ่าน service_role เท่านั้น
revoke all on public.user_invites from anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  inv public.user_invites%rowtype;
  is_azure boolean := coalesce(new.raw_app_meta_data->>'provider','') = 'azure';
begin
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;

  if is_azure and new.email is not null then
    select * into inv from public.user_invites
     where email = lower(new.email) and used_at is null;
  end if;

  if inv.email is not null then
    insert into public.profiles (id, email, full_name, role, status, rep_code, approved_at)
    values (new.id, new.email,
            coalesce(inv.full_name, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
            inv.role, 'approved', inv.rep_code, now())
    on conflict (id) do nothing;
    update public.user_invites set used_at = now() where email = inv.email;
  else
    insert into public.profiles (id, email, full_name)
    values (new.id, new.email,
            coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

-- กัน non-admin แก้ rep_code ของตัวเอง
create or replace function public.protect_profile_privileged_columns()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if new.id            is distinct from old.id
    or new.email         is distinct from old.email
    or new.role          is distinct from old.role
    or new.status        is distinct from old.status
    or new.dealer_code   is distinct from old.dealer_code
    or new.emp_id        is distinct from old.emp_id
    or new.rep_code      is distinct from old.rep_code
    or new.approved_by   is distinct from old.approved_by
    or new.approved_at   is distinct from old.approved_at
    or new.reject_reason is distinct from old.reject_reason
    or new.created_at    is distinct from old.created_at
    then
      raise exception 'permission denied: cannot change role/status/dealer_code/emp_id/rep_code of an account'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
