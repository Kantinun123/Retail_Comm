-- ยอดขายสินค้า (สรุป) จาก 2 แหล่ง:
--   di   = hpb_salesout_details.csv (Housing Expert) ; กลุ่มสินค้า = MISL5_Name
--   odoo = odoo_hpb_vendor_sales_detail.xlsx (SCG Home) ; กลุ่มสินค้า = MCH2
-- ระดับ: เดือน × ร้าน × กลุ่มสินค้า × พนักงานขาย (ไม่เก็บรายบิล/ลูกค้า) ; ตั้งแต่ 2025-01
-- row_key = source|period|dealer|group|salesperson -> sync เพิ่ม/แก้/ลบ
create table if not exists public.product_sales_lines (
  id              bigint generated always as identity primary key,
  row_key         text not null unique,
  source          text not null check (source in ('di','odoo')),
  period          text not null,
  dealer_code     text references public.dealers(code) on update cascade on delete set null,
  source_dealer   text,
  product_group   text not null,
  salesperson     text not null,
  amount          numeric not null default 0,
  qty             numeric not null default 0,
  line_count      integer not null default 0,
  last_sale_date  date,
  synced_at       timestamptz not null default now()
);
create index if not exists idx_product_sales_dealer_period on public.product_sales_lines (dealer_code, period);
create index if not exists idx_product_sales_source_period on public.product_sales_lines (source, period);
alter table public.product_sales_lines enable row level security;
revoke all on public.product_sales_lines from anon, authenticated;
