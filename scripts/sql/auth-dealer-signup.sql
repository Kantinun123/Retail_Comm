-- Auth: ร้านค้าสมัครเอง (email/password + ยืนยันอีเมล) -> admin อนุมัติ
-- - profiles.phone / requested_dealer_code : เก็บคำขอ (ยังไม่ให้สิทธิ์จนกว่า admin อนุมัติ)
-- - trigger handle_new_user อ่านคำขอจาก user_metadata (ตรวจว่ามีร้านจริง) ; ยังไม่ตั้ง role/dealer_code
-- - 1 บัญชีร้านค้า (approved) ต่อ 1 ร้าน : partial unique index
-- - protect trigger ครอบคลุมคอลัมน์ใหม่

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists requested_dealer_code text
  references public.dealers(code) on update cascade on delete set null;

create unique index if not exists profiles_one_dealer_account_per_store
  on public.profiles (dealer_code)
  where role = 'dealer' and status = 'approved' and dealer_code is not null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  inv public.user_invites%rowtype;
  is_azure boolean := coalesce(new.raw_app_meta_data->>'provider','') = 'azure';
  req_dealer text := nullif(trim(new.raw_user_meta_data->>'requested_dealer_code'), '');
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
    -- คำขอสมัครร้านค้า: เก็บไว้รออนุมัติ (ไม่ตั้ง role / dealer_code)
    if req_dealer is not null and not exists (select 1 from public.dealers where code = req_dealer) then
      req_dealer := null;
    end if;
    insert into public.profiles (id, email, full_name, phone, requested_role, requested_dealer_code)
    values (new.id, new.email,
            coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
            nullif(trim(new.raw_user_meta_data->>'phone'), ''),
            case when req_dealer is not null then 'dealer' end,
            req_dealer)
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

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
    or new.requested_role is distinct from old.requested_role
    or new.requested_dealer_code is distinct from old.requested_dealer_code
    or new.approved_by   is distinct from old.approved_by
    or new.approved_at   is distinct from old.approved_at
    or new.reject_reason is distinct from old.reject_reason
    or new.created_at    is distinct from old.created_at
    then
      raise exception 'permission denied: cannot change privileged columns of an account'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
