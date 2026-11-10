-- อัปโหลด BA Commission ผ่านหน้าศูนย์ข้อมูล
-- 1) master_aliases : ตารางแปลงชื่อ/รหัสจากระบบภายนอก (แทนไฟล์ Master_*.csv ที่อยู่แค่ในเครื่อง)
--      kind 'ba_channel' : channel_name/store_name ใน BA App -> dealer_code   (จาก Master_Dealer.csv "Dealer Name_BA App_N")
--      kind 'ba_emp'     : emp_id ใน BA App -> emp_code (CR)                 (จาก Master_Member.csv "Salesperson ID_BA App_N")
--    seed ด้วย scripts/seed-master-aliases.mjs
-- 2) bucket data-uploads (private) : เก็บไฟล์ต้นฉบับที่อัปโหลด
-- 3) replace_ba_incentive_period(period, rows) : ลบเดือนนั้นแล้ว insert ใหม่ใน transaction เดียว (พังกลางทาง = ไม่มีอะไรเปลี่ยน)

create table if not exists public.master_aliases (
  kind text not null,
  alias text not null,
  value text not null,
  note text,
  updated_at timestamptz not null default now(),
  primary key (kind, alias)
);
alter table public.master_aliases enable row level security;
revoke all on public.master_aliases from anon, authenticated;

insert into storage.buckets (id, name, public)
values ('data-uploads', 'data-uploads', false)
on conflict (id) do nothing;

create or replace function public.replace_ba_incentive_period(p_period text, p_rows jsonb)
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
  delete from ba_incentive_lines where period = p_period;
  get diagnostics v_deleted = row_count;
  insert into ba_incentive_lines (
    period, year, report_month, channel_name, dealer_code, dealer_name, region, province_name,
    emp_id, sale_rep_name, emp_code, rep_code, job_code, job_type, worktype_name, product_code, product_name,
    service_group, service_port, service_brand, sale_model, customer_name,
    invoice_date, customer_accepted_date, win_date, date_payment,
    invoice_net_amount, gmv_service, base_incentive, topup_amount, total_incentive, status_payment, source_file
  )
  select
    r.period, r.year, r.report_month, r.channel_name, r.dealer_code, r.dealer_name, r.region, r.province_name,
    r.emp_id, r.sale_rep_name, r.emp_code, r.rep_code, r.job_code, r.job_type, r.worktype_name, r.product_code, r.product_name,
    r.service_group, r.service_port, r.service_brand, r.sale_model, r.customer_name,
    r.invoice_date, r.customer_accepted_date, r.win_date, r.date_payment,
    r.invoice_net_amount, r.gmv_service, coalesce(r.base_incentive, 0), coalesce(r.topup_amount, 0), coalesce(r.total_incentive, 0),
    r.status_payment, r.source_file
  from jsonb_populate_recordset(null::ba_incentive_lines, p_rows) r;
  get diagnostics v_inserted = row_count;
  return jsonb_build_object('ok', true, 'deleted', v_deleted, 'inserted', v_inserted);
end; $$;
revoke execute on function public.replace_ba_incentive_period(text, jsonb) from public, anon, authenticated;
grant execute on function public.replace_ba_incentive_period(text, jsonb) to service_role;
