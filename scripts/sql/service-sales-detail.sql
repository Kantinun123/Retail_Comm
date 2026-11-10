-- ยอดขายงานบริการ (LHS/Rudy + BA) — รายละเอียดแบบหน้า "ยอดขายสินค้า"
-- 1) ผูกพนักงาน: rep_code (+ sales_name ของ BA)
--    - rudy : sales_name (ผู้สร้างโครงการใน Rudy) ตรงกับ sale_reps.name ในร้านเดียวกัน (ตัดช่องว่าง, ต้องตรงคนเดียว)
--    - ba   : job_code -> ba_incentive_lines (rep_code, sale_rep_name = พนักงาน BA ของร้าน)
--    เรียก refresh_service_sales_reps() หลัง import/sync ทุกครั้ง
-- 2) view service_sales_union + rep_code / sales_name (BA)
-- 3) RPC ทุกตัวรับ p_rep (พนักงานเห็นเฉพาะงานของตัวเอง) ; jobs กรอง ปี/กลุ่มย่อย/พนักงาน + แบ่งหน้า ; breakdown รายพนักงาน/รายร้าน

alter table public.service_sales_lines add column if not exists rep_code text;
alter table public.ba_service_sales_lines add column if not exists rep_code text;
alter table public.ba_service_sales_lines add column if not exists sales_name text;
create index if not exists idx_service_sales_rep on public.service_sales_lines (rep_code) where rep_code is not null;
create index if not exists idx_ba_service_sales_rep on public.ba_service_sales_lines (rep_code) where rep_code is not null;

create or replace function public.refresh_service_sales_reps()
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_rudy int; v_ba int;
begin
  update service_sales_lines l set rep_code = x.rep
  from (
    select l2.id,
           case when count(s.rep_code) = 1 then min(s.rep_code) end as rep
    from service_sales_lines l2
    left join sale_reps s
      on s.dealer_code = l2.dealer_code
     and l2.sales_name is not null
     and regexp_replace(lower(s.name), '\s', '', 'g') = regexp_replace(lower(l2.sales_name), '\s', '', 'g')
    group by l2.id
  ) x
  where x.id = l.id and l.rep_code is distinct from x.rep;
  get diagnostics v_rudy = row_count;

  update ba_service_sales_lines b set rep_code = x.rep_code, sales_name = x.sale_rep_name
  from (
    select b2.id, i.rep_code, nullif(btrim(i.sale_rep_name), '') as sale_rep_name
    from ba_service_sales_lines b2
    left join (
      select distinct on (job_code) job_code, rep_code, sale_rep_name
      from ba_incentive_lines
      where job_code is not null
      order by job_code, (rep_code is null), id
    ) i on i.job_code = b2.job_code
  ) x
  where x.id = b.id and (b.rep_code is distinct from x.rep_code or b.sales_name is distinct from x.sale_rep_name);
  get diagnostics v_ba = row_count;

  return json_build_object('ok', true, 'rudy_updated', v_rudy, 'ba_updated', v_ba);
end; $$;
revoke execute on function public.refresh_service_sales_reps() from public, anon, authenticated;
grant execute on function public.refresh_service_sales_reps() to service_role;

create or replace view public.service_sales_union with (security_invoker = true) as
 select 'rudy'::text as source,
    service_sales_lines.period,
    service_sales_lines.close_date as sale_date,
    service_sales_lines.dealer_code,
    service_sales_lines.group3,
    service_sales_lines.sub_group,
    service_sales_lines.solution_name,
    service_sales_lines.sub_solution_name,
    service_sales_lines.province_name,
    service_sales_lines.project_number,
    service_sales_lines.amount_incl_vat as amount,
    service_sales_lines.project_name as customer_name,
    null::text as type_of_job,
    service_sales_lines.sales_name,
    service_sales_lines.rep_code
   from service_sales_lines
union all
 select 'ba'::text as source,
    ba_service_sales_lines.period,
    ba_service_sales_lines.win_date as sale_date,
    ba_service_sales_lines.dealer_code,
    ba_service_sales_lines.group3,
    ba_service_sales_lines.service_group as sub_group,
    null::text as solution_name,
    ba_service_sales_lines.product_name as sub_solution_name,
    null::text as province_name,
    ba_service_sales_lines.job_code as project_number,
    ba_service_sales_lines.amount,
    ba_service_sales_lines.customer_name,
    ba_service_sales_lines.type_of_job,
    ba_service_sales_lines.sales_name,
    ba_service_sales_lines.rep_code
   from ba_service_sales_lines;
revoke all on public.service_sales_union from anon, authenticated;

-- ---------- RPC: เพิ่ม p_rep (ลบของเดิมก่อนเพราะเปลี่ยน signature) ----------
drop function if exists public.service_sales_summary(text, text);
drop function if exists public.service_sales_groups(text, text, text);
drop function if exists public.service_sales_month_groups(text, text, text);
drop function if exists public.service_sales_sources(text, text);
drop function if exists public.service_sales_jobs(text, text, text, text);

create or replace function public.service_sales_summary(p_dealer text default null, p_source text default null, p_rep text default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_months jsonb; v_count int; v_total numeric; v_latest date;
begin
  select coalesce(jsonb_agg(row_to_json(t) order by t.period desc), '[]'::jsonb) into v_months
  from (
    select period, sum(amount) as amount, count(*) as job_count
    from service_sales_union
    where period is not null
      and (p_dealer is null or dealer_code = p_dealer)
      and (p_source is null or source = p_source)
      and (p_rep is null or rep_code = p_rep)
    group by period
  ) t;
  select count(*), coalesce(sum(amount), 0), max(sale_date) into v_count, v_total, v_latest
  from service_sales_union
  where (p_dealer is null or dealer_code = p_dealer)
    and (p_source is null or source = p_source)
    and (p_rep is null or rep_code = p_rep);
  return jsonb_build_object('ok', true, 'count', coalesce(v_count, 0), 'total', coalesce(v_total, 0), 'months', v_months, 'latest_date', v_latest);
end; $$;

create or replace function public.service_sales_groups(p_dealer text default null, p_year text default null, p_source text default null, p_rep text default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_rows jsonb;
begin
  with base as (
    select group3, sub_group, amount from service_sales_union
    where (p_dealer is null or dealer_code = p_dealer)
      and (p_year is null or left(period, 4) = p_year)
      and (p_source is null or source = p_source)
      and (p_rep is null or rep_code = p_rep)
  )
  select coalesce(jsonb_agg(row_to_json(x) order by x.amount desc), '[]'::jsonb) into v_rows
  from (
    select g.group3, sum(g.amount) as amount, count(*) as job_count,
      (select coalesce(jsonb_agg(row_to_json(s) order by s.amount desc), '[]'::jsonb)
       from (select b.sub_group as label, sum(b.amount) as amount, count(*) as job_count
             from base b where b.group3 = g.group3 and b.sub_group is not null group by b.sub_group) s) as subs
    from base g group by g.group3
  ) x;
  return jsonb_build_object('ok', true, 'groups', v_rows);
end; $$;

create or replace function public.service_sales_month_groups(p_dealer text default null, p_year text default null, p_source text default null, p_rep text default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_rows jsonb;
begin
  with base as (
    select period, group3, sub_group, amount from service_sales_union
    where period is not null
      and (p_dealer is null or dealer_code = p_dealer)
      and (p_year is null or left(period, 4) = p_year)
      and (p_source is null or source = p_source)
      and (p_rep is null or rep_code = p_rep)
  )
  select coalesce(jsonb_agg(row_to_json(x) order by x.period desc), '[]'::jsonb) into v_rows
  from (
    select m.period, sum(m.amount) as amount, count(*) as job_count,
      (select coalesce(jsonb_agg(row_to_json(g) order by g.amount desc), '[]'::jsonb)
       from (
         select b.group3, sum(b.amount) as amount, count(*) as job_count,
           (select coalesce(jsonb_agg(row_to_json(s) order by s.amount desc), '[]'::jsonb)
            from (select c.sub_group as label, sum(c.amount) as amount, count(*) as job_count
                  from base c where c.period = m.period and c.group3 = b.group3 and c.sub_group is not null
                  group by c.sub_group) s) as subs
         from base b where b.period = m.period group by b.group3
       ) g) as groups
    from base m group by m.period
  ) x;
  return jsonb_build_object('ok', true, 'months', v_rows);
end; $$;

create or replace function public.service_sales_sources(p_dealer text default null, p_year text default null, p_rep text default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_rows jsonb;
begin
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_rows
  from (
    select source, sum(amount) as amount, count(*) as job_count
    from service_sales_union
    where (p_dealer is null or dealer_code = p_dealer)
      and (p_year is null or left(period, 4) = p_year)
      and (p_rep is null or rep_code = p_rep)
    group by source
  ) t;
  return jsonb_build_object('ok', true, 'sources', v_rows);
end; $$;

-- ราย job: เดือน (p_period) หรือทั้งปี (p_year) ; กรองกลุ่ม/กลุ่มย่อย/ร้าน/พนักงาน ; แบ่งหน้า
-- p_sales = ชื่อในไฟล์ของคนที่ไม่ใช่พนักงานในระบบ ; p_unassigned = งานที่ไม่มีชื่อพนักงาน
-- subs = กลุ่มย่อยของชุดนี้ (ไม่สน p_sub_group) ไว้ทำปุ่มกรอง
create or replace function public.service_sales_jobs(
  p_dealer text default null, p_period text default null, p_group text default null, p_source text default null,
  p_year text default null, p_sub_group text default null, p_rep text default null, p_sales text default null,
  p_unassigned boolean default false, p_order text default 'amount', p_limit int default 300, p_offset int default 0
)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with base as (
    select * from service_sales_union u
    where (p_period is not null or p_year is not null)
      and (p_period is null or u.period = p_period)
      and (p_year is null or left(u.period, 4) = p_year)
      and (p_group is null or u.group3 = p_group)
      and (p_dealer is null or u.dealer_code = p_dealer)
      and (p_source is null or u.source = p_source)
      and (p_rep is null or u.rep_code = p_rep)
      and (p_sales is null or (u.rep_code is null and u.sales_name = p_sales))
      and (not coalesce(p_unassigned, false) or (u.rep_code is null and u.sales_name is null))
  ),
  sel as (
    select b.*,
           row_number() over (order by case when p_order = 'date' then null else b.amount end desc nulls last,
                                       case when p_order = 'date' then b.sale_date end desc nulls last,
                                       b.amount desc, b.project_number) as ord
    from base b
    where p_sub_group is null or b.sub_group = p_sub_group
  ),
  page as (
    select source, period, sale_date as close_date, group3, sub_group, sub_solution_name, solution_name,
           province_name, project_number, amount as amount_incl_vat, customer_name, type_of_job, sales_name, rep_code, ord
    from sel
    order by ord
    offset greatest(coalesce(p_offset, 0), 0) limit least(greatest(coalesce(p_limit, 300), 1), 1000)
  )
  select jsonb_build_object(
    'ok', p_period is not null or p_year is not null,
    'jobs', coalesce((select jsonb_agg(row_to_json(p) order by p.ord) from page p), '[]'::jsonb),
    'total', (select count(*) from sel),
    'total_amount', (select coalesce(sum(amount), 0) from sel),
    'subs', coalesce((select jsonb_agg(row_to_json(s) order by s.amount desc)
                      from (select sub_group as label, sum(amount) as amount, count(*) as job_count
                            from base where sub_group is not null group by sub_group) s), '[]'::jsonb)
  );
$$;

-- แยกรายพนักงาน (ร้านเดียว) / รายร้าน (admin ทุกร้าน) ต่อเดือน × กลุ่ม — client รวมเป็นทั้งปี/รายเดือนเอง
create or replace function public.service_sales_breakdown(p_dealer text default null, p_year text default null, p_source text default null)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with base as (
    select * from service_sales_union
    where period is not null
      and (p_dealer is null or dealer_code = p_dealer)
      and (p_year is null or left(period, 4) = p_year)
      and (p_source is null or source = p_source)
  ),
  people as (
    select b.period, b.group3, b.rep_code,
           case when b.rep_code is null then b.sales_name end as sales_name,
           max(r.name) as name, max(r.nickname) as nickname,
           sum(b.amount) as amount, count(*) as job_count
    from base b left join sale_reps r on r.rep_code = b.rep_code
    where p_dealer is not null
    group by b.period, b.group3, b.rep_code, case when b.rep_code is null then b.sales_name end
  ),
  stores as (
    select b.period, b.dealer_code, d.name as dealer_name, d.model, sum(b.amount) as amount, count(*) as job_count
    from base b left join dealers d on d.code = b.dealer_code
    where p_dealer is null
    group by b.period, b.dealer_code, d.name, d.model
  )
  select jsonb_build_object(
    'ok', true,
    'people', coalesce((select jsonb_agg(row_to_json(p)) from people p), '[]'::jsonb),
    'stores', coalesce((select jsonb_agg(row_to_json(s)) from stores s), '[]'::jsonb)
  );
$$;

revoke execute on function public.service_sales_summary(text, text, text) from public, anon, authenticated;
revoke execute on function public.service_sales_groups(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.service_sales_month_groups(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.service_sales_sources(text, text, text) from public, anon, authenticated;
revoke execute on function public.service_sales_jobs(text, text, text, text, text, text, text, text, boolean, text, int, int) from public, anon, authenticated;
revoke execute on function public.service_sales_breakdown(text, text, text) from public, anon, authenticated;
grant execute on function public.service_sales_summary(text, text, text) to service_role;
grant execute on function public.service_sales_groups(text, text, text, text) to service_role;
grant execute on function public.service_sales_month_groups(text, text, text, text) to service_role;
grant execute on function public.service_sales_sources(text, text, text) to service_role;
grant execute on function public.service_sales_jobs(text, text, text, text, text, text, text, text, boolean, text, int, int) to service_role;
grant execute on function public.service_sales_breakdown(text, text, text) to service_role;
