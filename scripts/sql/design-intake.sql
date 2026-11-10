-- แบบรับเข้า (CRM Opportunity: crm_trn_opportunity.xlsx) — เฉพาะ BU Housing Expert (GT) + SCG Home Retail (JV) ตั้งแต่ 2025
-- คีย์ = opp_id (id ของ CRM) ; เดือน = crm_created_date (ตามที่ Power BI ใช้)
-- design_type: 'material' = งานถอดแบบ/ออกแบบประมาณการ ; 'solution' = งานบริการอื่นที่มี service_sub_solution ; null = ไม่มีข้อมูลงานบริการ
-- ไม่เก็บชื่อลูกค้า ; creator = crm_created_name (username/อีเมลของผู้สร้างเอกสาร)
create table if not exists public.design_intake_lines (
  id                   bigint generated always as identity primary key,
  opp_id               text not null unique,
  created_at_crm       timestamptz not null,
  created_date         date not null,
  period               text not null,
  business_unit        text,
  store_group_name     text,
  dealer_code          text references public.dealers(code) on update cascade on delete set null,
  design_type          text check (design_type in ('material','solution')),
  service_category     text,
  service_solution     text,
  service_sub_solution text,
  product_category     text,
  product_solution     text,
  product_sub_solution text,
  stage                text,
  reason               text,
  origin               text,
  sub_origin           text,
  creator              text,
  rep_code             text,
  expected_product     numeric,
  expected_service     numeric,
  actual_sale          numeric,
  actual_close_date    date,
  rudy_id              text,
  home_id              text,
  crm_modified_at      timestamptz,
  source_file          text,
  synced_at            timestamptz not null default now()
);
create index if not exists idx_design_intake_dealer_period on public.design_intake_lines (dealer_code, period);
create index if not exists idx_design_intake_period on public.design_intake_lines (period);
create index if not exists idx_design_intake_rep on public.design_intake_lines (rep_code);
alter table public.design_intake_lines enable row level security;
revoke all on public.design_intake_lines from anon, authenticated;
