-- สรุปยอดขายสินค้า (DI / Odoo) สำหรับหน้า /app/product-sales
-- p_source       : null = ทุกแหล่ง | 'di' | 'odoo'
-- p_dealer       : null = ทุกร้าน (admin) | รหัสร้าน
-- p_rep          : เฉพาะพนักงานในระบบคนนั้น (rep_code) — พนักงานเห็นเฉพาะยอดที่ตัวเองขาย
-- p_salesperson  : เฉพาะชื่อพนักงานขายในไฟล์ (ใช้กับร้าน เมื่อกดคนที่ไม่ได้อยู่ในระบบ)
-- ยอดหลัก (months/groups) นับเฉพาะแถวที่ map ร้านได้ ; แถว "ไม่ระบุร้าน" แยกไว้ใน unmapped (เฉพาะ admin ทุกร้าน)
create or replace function public.product_sales_summary(
  p_source text default null,
  p_dealer text default null,
  p_rep text default null,
  p_salesperson text default null
)
returns json
language sql
stable
security definer
set search_path to 'public'
as $$
  with base as (
    select l.source, l.period, l.dealer_code, l.product_group, l.salesperson, l.rep_code, l.amount, l.qty, l.line_count
    from product_sales_lines l
    where l.dealer_code is not null
      and (p_source is null or l.source = p_source)
      and (p_dealer is null or l.dealer_code = p_dealer)
      and (p_rep is null or l.rep_code = p_rep)
      and (p_salesperson is null or l.salesperson = p_salesperson)
  ),
  months as (
    select period, sum(amount) as amount, sum(qty) as qty, sum(line_count) as lines
    from base group by period
  ),
  groups as (
    select period, source, product_group, sum(amount) as amount, sum(qty) as qty
    from base group by period, source, product_group
  ),
  people as (
    select b.period, b.rep_code,
           case when b.rep_code is null then b.salesperson end as salesperson,
           max(r.name) as name, max(r.nickname) as nickname,
           sum(b.amount) as amount, sum(b.line_count) as lines
    from base b left join sale_reps r on r.rep_code = b.rep_code
    where p_dealer is not null and p_rep is null and p_salesperson is null
    group by b.period, b.rep_code, case when b.rep_code is null then b.salesperson end
  ),
  stores as (
    select b.period, b.dealer_code, d.name as dealer_name, d.model, sum(b.amount) as amount
    from base b left join dealers d on d.code = b.dealer_code
    where p_dealer is null and p_rep is null and p_salesperson is null
    group by b.period, b.dealer_code, d.name, d.model
  ),
  unmapped as (
    select l.period, l.source, l.source_dealer, sum(l.amount) as amount
    from product_sales_lines l
    where l.dealer_code is null
      and p_dealer is null and p_rep is null and p_salesperson is null
      and (p_source is null or l.source = p_source)
    group by l.period, l.source, l.source_dealer
  )
  select json_build_object(
    'ok', true,
    'sources',  coalesce((select json_agg(distinct source) from base), '[]'::json),
    'months',   coalesce((select json_agg(m order by m.period desc) from months m), '[]'::json),
    'groups',   coalesce((select json_agg(g) from groups g), '[]'::json),
    'people',   coalesce((select json_agg(x) from people x), '[]'::json),
    'stores',   coalesce((select json_agg(s) from stores s), '[]'::json),
    'unmapped', coalesce((select json_agg(u) from unmapped u), '[]'::json),
    'updated_at',  (select max(synced_at) from product_sales_lines where p_source is null or source = p_source),
    'latest_date', (select max(last_sale_date) from product_sales_lines where p_source is null or source = p_source)
  );
$$;
revoke execute on function public.product_sales_summary(text, text, text, text) from public, anon, authenticated;
grant execute on function public.product_sales_summary(text, text, text, text) to service_role;
