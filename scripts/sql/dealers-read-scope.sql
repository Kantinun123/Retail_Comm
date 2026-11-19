-- ร้านที่ผู้ใช้จริง (ไม่ใช่ร้านค้า/admin) อ่านจากตาราง dealers ฝั่งเบราว์เซอร์ได้ (ใช้ตั้ง session.dealer หลังเลือกร้าน)
-- Area / Coach / RE: ร้านใน rep_store_assignments ; หัวหน้า Area: ทุกร้านที่มี Area ดูแล ; พนักงานขาย: ร้านปัจจุบันจาก sale_reps
-- migration: dealers_read_area_scope + dealers_read_sales_scope (19 พ.ย. 69)
create or replace function public.my_area_dealer_codes()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select a.dealer_code
  from public.rep_store_assignments a
  join public.profiles p on p.rep_code = a.rep_code
  where p.id = auth.uid() and p.status = 'approved' and p.role in ('area', 'coach', 're')
  union
  select a.dealer_code
  from public.rep_store_assignments a
  where exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'approved' and p.role = 'area_head')
  union
  select r.dealer_code
  from public.sale_reps r
  join public.profiles p on p.rep_code = r.rep_code
  where p.id = auth.uid() and p.status = 'approved' and p.role = 'sales' and r.is_active and r.dealer_code is not null
$$;
revoke execute on function public.my_area_dealer_codes() from public, anon;
grant execute on function public.my_area_dealer_codes() to authenticated, service_role;

alter policy "read dealers scoped" on public.dealers
  using (is_anon_demo() or is_admin() or code = my_dealer_code() or code in (select public.my_area_dealer_codes()));