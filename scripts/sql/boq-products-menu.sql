-- BOQ: กลุ่ม dropdown 18 กลุ่ม (20 พ.ย. 69) ; ข้อมูลเติมด้วย scripts/import-boq-products.mjs
alter table public.boq_products add column if not exists menu text, add column if not exists menu_sort int;
-- backup ก่อนเปลี่ยน: public.bk_20261120_boq_products
