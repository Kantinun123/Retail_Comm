-- ความสดของข้อมูลแต่ละแหล่ง (ไม่มีข้อมูลธุรกิจ มีแค่วันที่) — ใช้แสดง "ข้อมูลถึง / อัปเดต" และสถานะ "รอข้อมูล"
-- daily  : data_date = วันที่ของรายการล่าสุดในข้อมูล ; synced_at = sync สำเร็จล่าสุด (sync_runs)
-- monthly: เดือนล่าสุดที่มีไฟล์ของแหล่งนั้น (ทุกร้าน) -> เดือนที่ใหม่กว่านี้ = "รอข้อมูล"
-- เรียกผ่าน /api/data-freshness (service role) — ทุกบทบาทอ่านได้
create or replace function public.data_freshness()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with ok as (
    select distinct on (job) job, finished_at from sync_runs where status = 'ok' order by job, started_at desc
  ),
  -- ไม่นับวันที่ในอนาคต (ต้นทางมีรายการลงวันที่ล่วงหน้า เช่น DI 13 พ.ย. ทั้งที่วันนี้ 10 พ.ย.)
  t as (select (now() at time zone 'Asia/Bangkok')::date as today),
  d(job, data_date) as (
    values
      ('product-di',    (select max(last_sale_date) from product_sales_lines, t where source = 'di' and last_sale_date <= t.today)),
      ('product-odoo',  (select max(last_sale_date) from product_sales_lines, t where source = 'odoo' and last_sale_date <= t.today)),
      ('lhs',           (select max(close_date) from service_sales_lines, t where close_date <= t.today)),
      ('ba',            (select max(win_date) from ba_service_sales_lines, t where win_date <= t.today)),
      ('cust-sat',      (select max(eval_date) from cust_sat_lines, t where eval_date <= t.today)),
      ('scghome-sat',   (select max(eval_date) from scghome_sat_lines, t where eval_date <= t.today)),
      ('store-eval',    (select max(eval_date) from store_eval_lines, t where eval_date <= t.today)),
      ('design-intake', (select max(created_date) from design_intake_lines, t where created_date <= t.today))
  )
  select jsonb_build_object(
    'ok', true,
    'now', now(),
    'daily', (select jsonb_object_agg(d.job, jsonb_build_object('data_date', d.data_date, 'synced_at', ok.finished_at)) from d left join ok on ok.job = d.job),
    'monthly', jsonb_build_object(
      'back-margin',        (select max(sales_period) from back_margin_lines),
      'profit-share-ba',    (select max(period) from ba_profit_share_lines),
      'product-commission', (select max(period) from commission_product_lines),
      'ba-commission',      (select max(period) from ba_incentive_lines),
      'lhs-commission',     (select max(period) from lhs_commission_lines where order_number is not null),
      'lhs-discount',       (select max(period) from lhs_purchase_discount_lines)
    )
  );
$$;
revoke execute on function public.data_freshness() from public, anon, authenticated;
grant execute on function public.data_freshness() to service_role;
