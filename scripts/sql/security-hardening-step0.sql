-- =====================================================================
-- Security hardening ข้อ 0 (ก่อนทำ login จริง)
-- ใช้แล้วกับโปรเจกต์ Supabase retail-comm (migration ชื่อ security_hardening_step0)
-- เก็บไว้เป็นบันทึก/สร้างซ้ำได้ — idempotent (รันซ้ำได้)
--
-- ปัญหาที่แก้:
--  1) ผู้ใช้ที่ล็อกอินแล้วแก้ role/status/dealer_code/emp_id ของตัวเองใน profiles ได้
--     (policy "update own profile" + UPDATE ทุกคอลัมน์ + ไม่มี trigger) -> ยกตัวเองเป็น admin ได้
--  2) RPC ข้อมูล (SECURITY DEFINER) ถูก grant ให้ anon/authenticated/public
--     -> ใครมี public key ก็ดึงข้อมูลทุกร้าน + เบอร์/อีเมล/วันเกิด/Line พนักงานได้โดยไม่ล็อกอิน
--
-- ยังไม่ได้แก้ (ทำตอน cutover ไป login จริง):
--  - policy ของตารางที่ใช้ is_anon_demo() (anonymous sign-in ของโหมดเดโม) ยังอนุญาต session นิรนามอ่านตารางตรงๆ
--  - ปิด Anonymous sign-ins, เปิด Leaked password protection
-- =====================================================================

-- ===== 1) profiles: กันผู้ใช้ทั่วไปยกสิทธิ์ตัวเอง =====
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- ผู้ใช้ผ่าน API (authenticated/anon) ที่ไม่ใช่ admin แก้คอลัมน์สิทธิ์/สังกัดไม่ได้
  -- service_role / postgres (server-side, migration) ผ่านได้
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if new.id            is distinct from old.id
    or new.email         is distinct from old.email
    or new.role          is distinct from old.role
    or new.status        is distinct from old.status
    or new.dealer_code   is distinct from old.dealer_code
    or new.emp_id        is distinct from old.emp_id
    or new.approved_by   is distinct from old.approved_by
    or new.approved_at   is distinct from old.approved_at
    or new.reject_reason is distinct from old.reject_reason
    or new.created_at    is distinct from old.created_at
    then
      raise exception 'permission denied: cannot change role/status/dealer_code/emp_id of an account'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_privileged_columns on public.profiles;
create trigger protect_profile_privileged_columns
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();

-- anon ไม่มีเหตุผลที่ต้องแก้ profiles เลย
revoke update on public.profiles from anon;

-- ===== 2) ถอนสิทธิ์ execute ของ RPC ข้อมูลจาก public/anon/authenticated =====
-- เหลือเฉพาะ service_role (API ของแอปใช้ service-role อยู่แล้ว)
-- ยกเว้น: ฟังก์ชันช่วยของ RLS (ต้องให้ผู้เรียกเรียกได้), handle_new_user (trigger), my_dealer_access
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.proname not in ('is_admin','is_anon_demo','my_dealer_code','my_emp_id','my_role','my_dealer_access','handle_new_user')
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- หมายเหตุ: ฟังก์ชันใหม่ที่สร้างหลังจากนี้จะได้ EXECUTE ให้ PUBLIC ตามค่าเริ่มต้นของ Postgres อีก
-- ถ้าเป็น RPC ข้อมูลที่เรียกผ่าน service-role ให้ revoke ทุกครั้งที่สร้าง:
--   revoke execute on function public.<ชื่อ>(<args>) from public, anon, authenticated;
--   grant  execute on function public.<ชื่อ>(<args>) to service_role;
-- ตรวจซ้ำได้ด้วย: node scripts/check-anon-exposure.mjs  (ผลที่ถูกต้อง: EXPOSED=0)
