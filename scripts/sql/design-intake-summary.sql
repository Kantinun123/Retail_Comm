-- สรุปแบบรับเข้า (Material / Solution) สำหรับหน้า /app/design-intake
-- p_dealer null = ทุกร้าน (admin) ; p_rep = เฉพาะพนักงานคนนั้น (SE)
-- นับเฉพาะ design_type ไม่ว่าง ; ร้านโมเดล Housing Expert / SCG Home (+ ไม่ระบุร้าน เมื่อดูทุกร้าน)
create or replace function public.design_intake_summary(p_dealer text default null, p_rep text default null)
returns json
language sql
stable
security definer
set search_path to 'public'
as $$
  with base as (
    select l.period, l.dealer_code, l.rep_code, l.design_type, l.stage
    from design_intake_lines l
    left join dealers d on d.code = l.dealer_code
    where l.design_type is not null
      and (p_dealer is null or l.dealer_code = p_dealer)
      and (p_rep is null or l.rep_code = p_rep)
      and (l.dealer_code is null or d.model in ('Housing Expert', 'SCG Home'))
  ),
  months as (
    select period,
           count(*) filter (where design_type = 'material') as material,
           count(*) filter (where design_type = 'solution') as solution,
           count(*) filter (where stage = 'Won' and design_type = 'material') as won_material,
           count(*) filter (where stage = 'Won' and design_type = 'solution') as won_solution
    from base group by period
  ),
  stores as (
    select b.period, b.dealer_code, d.name as dealer_name, d.model,
           count(*) filter (where b.design_type = 'material') as material,
           count(*) filter (where b.design_type = 'solution') as solution
    from base b left join dealers d on d.code = b.dealer_code
    where p_dealer is null and p_rep is null
    group by b.period, b.dealer_code, d.name, d.model
  ),
  reps as (
    select b.period, b.rep_code, r.name, r.nickname,
           count(*) filter (where b.design_type = 'material') as material,
           count(*) filter (where b.design_type = 'solution') as solution
    from base b left join sale_reps r on r.rep_code = b.rep_code
    where p_dealer is not null and p_rep is null
    group by b.period, b.rep_code, r.name, r.nickname
  )
  select json_build_object(
    'ok', true,
    'months', coalesce((select json_agg(m order by m.period desc) from months m), '[]'::json),
    'stores', coalesce((select json_agg(s) from stores s), '[]'::json),
    'reps',   coalesce((select json_agg(x) from reps x), '[]'::json),
    'updated_at', (select max(synced_at) from design_intake_lines),
    'latest_date', (select max(created_date) from design_intake_lines)
  );
$$;
revoke execute on function public.design_intake_summary(text, text) from public, anon, authenticated;
grant execute on function public.design_intake_summary(text, text) to service_role;
