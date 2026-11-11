-- แทนที่ BA Profit Share ทั้งเดือนใน transaction เดียว (ใช้กับ scripts/import-ba-monthly.mjs และการอัปโหลดผ่านเว็บในอนาคต)
create or replace function public.replace_ba_profit_share_period(p_period text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_deleted int; v_inserted int;
begin
  if p_period !~ '^\d{4}-\d{2}$' then raise exception 'invalid period %', p_period; end if;
  if exists (select 1 from jsonb_array_elements(p_rows) r where r->>'period' is distinct from p_period) then
    raise exception 'rows must all belong to period %', p_period;
  end if;
  delete from ba_profit_share_lines where period = p_period;
  get diagnostics v_deleted = row_count;
  insert into ba_profit_share_lines (
    period, channel_name, store_name, store_model, dealer_code, dealer_name, sale_order_no, customer_name, invoice_no, discount_code,
    job_code, job_type, worktype_name, product_code, product_name, product_brand, sku_code, sku_name, job_status,
    payment_date, customer_accepted_date, actual_paid, jo_amount, margin, profit_share_rate, profit_share_amount,
    sale_model, job_id, adj_shop_service_name, shop_condition, mou_type, store_format, source_file, sale_rep_name
  )
  select
    r.period, r.channel_name, r.store_name, r.store_model, r.dealer_code, r.dealer_name, r.sale_order_no, r.customer_name, r.invoice_no, r.discount_code,
    r.job_code, r.job_type, r.worktype_name, r.product_code, r.product_name, r.product_brand, r.sku_code, r.sku_name, r.job_status,
    r.payment_date, r.customer_accepted_date, r.actual_paid, r.jo_amount, r.margin, r.profit_share_rate, coalesce(r.profit_share_amount, 0),
    r.sale_model, r.job_id, r.adj_shop_service_name, r.shop_condition, r.mou_type, r.store_format, r.source_file, r.sale_rep_name
  from jsonb_populate_recordset(null::ba_profit_share_lines, p_rows) r;
  get diagnostics v_inserted = row_count;
  return jsonb_build_object('ok', true, 'deleted', v_deleted, 'inserted', v_inserted);
end; $$;
revoke execute on function public.replace_ba_profit_share_period(text, jsonb) from public, anon, authenticated;
grant execute on function public.replace_ba_profit_share_period(text, jsonb) to service_role;
