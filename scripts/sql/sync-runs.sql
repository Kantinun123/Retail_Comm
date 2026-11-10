-- ประวัติการรัน sync อัตโนมัติ (เขียนโดย scripts/sync-runner.mjs) — ใช้แสดง "อัปเดตล่าสุด" / หน้าศูนย์ข้อมูล
-- status: ok = sync สำเร็จ | skipped = ไฟล์ยังไม่เปลี่ยน/กำลังดาวน์โหลด | guard = หยุดเพราะข้อมูลลดผิดปกติ | failed = ผิดพลาด
create table if not exists public.sync_runs (
  id bigint generated always as identity primary key,
  job text not null,
  run_group text not null,
  status text not null check (status in ('ok','skipped','failed','guard')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  exit_code int,
  file_mtime timestamptz,
  summary text,
  host text
);
create index if not exists idx_sync_runs_job_time on public.sync_runs (job, started_at desc);
alter table public.sync_runs enable row level security;
revoke all on public.sync_runs from anon, authenticated;
