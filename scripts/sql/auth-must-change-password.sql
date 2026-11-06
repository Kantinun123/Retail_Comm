-- บัญชีที่ admin แจกให้ร้าน: บังคับเปลี่ยนรหัสผ่านตอนเข้าครั้งแรก
-- ผู้ใช้แก้คอลัมน์นี้เองไม่ได้ (เคลียร์ผ่าน /api/account/password ด้วย service_role หลังเปลี่ยนรหัสจริงเท่านั้น)

alter table public.profiles add column if not exists must_change_password boolean not null default false;

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
    or new.must_change_password is distinct from old.must_change_password
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
