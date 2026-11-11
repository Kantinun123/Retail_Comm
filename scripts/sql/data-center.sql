-- ศูนย์ข้อมูล (/app/data-center) — เฉพาะ admin (เรียกผ่าน API ด้วย service role)
-- 1) data_uploads : ประวัติการอัปโหลดไฟล์รายเดือน
-- 2) data_center_summary() : สถานะ sync รายวัน (จาก sync_runs) + ข้อมูลล่าสุดของแต่ละแหล่ง + ความครบรายเดือน

create table if not exists public.data_uploads (
  id bigint generated always as identity primary key,
  source text not null,                 -- เช่น 'ba-commission'
  period text not null,                 -- 'YYYY-MM'
  status text not null check (status in ('applied','cancelled','failed')),
  file_names text[] not null default '{}',
  file_count int not null default 0,
  rows_before int,
  rows_after int,
  amount_before numeric,
  amount_after numeric,
  message text,
  uploaded_by text,
  storage_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_data_uploads_source_period on public.data_uploads (source, period, created_at desc);
alter table public.data_uploads enable row level security;
revoke all on public.data_uploads from anon, authenticated;

create or replace function public.data_center_summary()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with runs as (
    select * from sync_runs where started_at >= now() - interval '14 days'
  ),
  last_run as (
    select distinct on (job) job, status, started_at, finished_at, summary, file_mtime
    from runs order by job, started_at desc
  ),
  last_ok as (
    select distinct on (job) job, finished_at, summary, file_mtime
    from runs where status = 'ok' order by job, started_at desc
  ),
  days as (
    select job, (started_at at time zone 'Asia/Bangkok')::date as d,
           case when bool_or(status = 'ok') then 'ok'
                when bool_or(status = 'guard') then 'guard'
                when bool_or(status = 'failed') then 'failed'
                else 'skipped' end as status,
           count(*) as runs
    from runs group by 1, 2
  ),
  latest as (
    select 'ba' as job, max(win_date)::text as data_date, count(*) as total from ba_service_sales_lines
    union all select 'cust-sat', max(eval_date)::text, count(*) from cust_sat_lines
    union all select 'scghome-sat', max(eval_date)::text, count(*) from scghome_sat_lines
    union all select 'store-eval', max(eval_date)::text, count(*) from store_eval_lines
    union all select 'product-di', max(last_sale_date)::text, count(*) from product_sales_lines where source = 'di'
    union all select 'product-odoo', max(last_sale_date)::text, count(*) from product_sales_lines where source = 'odoo'
    union all select 'lhs', max(close_date)::text, count(*) from service_sales_lines
    union all select 'lhs-discount', max(coalesce(project_close_date, order_created_date))::text, count(*) from lhs_purchase_discount_lines
    union all select 'design-intake', max(created_date)::text, count(*) from design_intake_lines
  ),
  monthly as (
    select 'back-margin' as source, sales_period as period, count(*) as rows, sum(total_back_margin) as amount,
           count(distinct source_file) as files, count(distinct dealer_code) as stores, max(created_at) as loaded_at
    from back_margin_lines where sales_period >= '2025-01' group by sales_period
    union all
    select 'profit-share-ba', period, count(*), sum(profit_share_amount), count(distinct source_file), count(distinct dealer_code), max(created_at)
    from ba_profit_share_lines where period >= '2025-01' group by period
    union all
    select 'product-commission', period, count(*), sum(commission_net), count(distinct source_file), count(distinct dealer_code), max(created_at)
    from commission_product_lines where period >= '2025-01' group by period
    union all
    select 'ba-commission', period, count(*), sum(total_incentive), count(distinct source_file), count(distinct dealer_code), max(created_at)
    from ba_incentive_lines where period >= '2025-01' group by period
    union all
    select 'lhs-commission', period, count(*), sum(commission), count(distinct source_file), count(distinct dealer_code), max(created_at)
    from lhs_commission_lines where period >= '2025-01' and order_number is not null group by period
    union all
    select 'lhs-discount', period, count(*), sum(discount_amount), count(distinct source_file), count(distinct dealer_code), max(created_at)
    from lhs_purchase_discount_lines where period >= '2025-01' group by period
  )
  select jsonb_build_object(
    'ok', true,
    'now', now(),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'job', l.job,
        'last_run', (select to_jsonb(r) - 'job' from last_run r where r.job = l.job),
        'last_ok', (select to_jsonb(o) - 'job' from last_ok o where o.job = l.job),
        'days', coalesce((select jsonb_agg(jsonb_build_object('d', x.d, 'status', x.status, 'runs', x.runs) order by x.d) from days x where x.job = l.job), '[]'::jsonb),
        'data_date', l.data_date,
        'total', l.total
      ))
      from latest l
    ), '[]'::jsonb),
    'monthly', coalesce((select jsonb_agg(to_jsonb(m) order by m.source, m.period) from monthly m), '[]'::jsonb),
    'uploads', coalesce((
      select jsonb_agg(to_jsonb(u) order by u.created_at desc)
      from (select id, source, period, status, file_count, file_names[1:3] as file_names, rows_before, rows_after,
                   amount_before, amount_after, message, uploaded_by, created_at
            from data_uploads order by created_at desc limit 30) u
    ), '[]'::jsonb)
  );
$$;
revoke execute on function public.data_center_summary() from public, anon, authenticated;
grant execute on function public.data_center_summary() to service_role;
