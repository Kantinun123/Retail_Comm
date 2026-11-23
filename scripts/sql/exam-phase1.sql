-- Competency Test (ข้อสอบ SE) เฟส 1 : หัวข้อ / ข้อสอบ / ตัวเลือก / รอบสอบ / การสอบ
-- RLS เปิดไม่มี policy = เข้าถึงผ่าน API (service role) เท่านั้น ; เฉลย (is_correct) ห้ามส่งออกไปเบราว์เซอร์

create table if not exists public.exam_topics (
  id serial primary key,
  code text not null unique,            -- ชื่อชีตในไฟล์ข้อสอบ
  title text not null,
  group_name text,
  sort int not null default 0,
  is_active boolean not null default true
);

create table if not exists public.exam_questions (
  id bigserial primary key,
  topic_id int not null references public.exam_topics(id) on delete cascade,
  sort int not null,
  kind text not null default 'single' check (kind in ('single', 'multi')),
  body text not null,
  image_paths text[] not null default '{}',     -- path ใน bucket exam-images
  explanation text,                              -- ไม่แสดงให้ผู้สอบ
  is_active boolean not null default true,
  problem text,                                  -- เหตุผลที่ยังใช้ไม่ได้ (ไม่มีเฉลย / ตัวเลือกไม่ครบ)
  src_row int,
  unique (topic_id, sort)
);

create table if not exists public.exam_options (
  id bigserial primary key,
  question_id bigint not null references public.exam_questions(id) on delete cascade,
  sort int not null,
  body text not null,
  is_correct boolean not null default false,
  unique (question_id, sort)
);

create table if not exists public.exam_rounds (
  id serial primary key,
  title text not null,
  starts_on date not null,
  deadline_on date not null,
  pass_percent int not null default 80 check (pass_percent between 1 and 100),
  status text not null default 'open' check (status in ('open', 'closed')),
  notified_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  check (deadline_on >= starts_on)
);

create table if not exists public.exam_attempts (
  id bigserial primary key,
  round_id int not null references public.exam_rounds(id) on delete cascade,
  topic_id int not null references public.exam_topics(id),
  rep_code text not null,
  user_id uuid,
  is_test boolean not null default false,
  seq int not null,                              -- ครั้งที่ (ต่อรอบ/คน/หัวข้อ)
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  question_ids bigint[] not null,
  option_order jsonb not null default '{}'::jsonb,   -- question_id -> [option_id...] ลำดับที่สุ่มให้คนนี้
  answers jsonb not null default '{}'::jsonb,        -- question_id -> [option_id...]
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score int,
  total int,
  percent numeric(5, 2),
  passed boolean
);

create index if not exists exam_attempts_lookup on public.exam_attempts (round_id, rep_code, topic_id);
create unique index if not exists exam_one_open_attempt
  on public.exam_attempts (round_id, rep_code, topic_id, is_test) where status = 'in_progress';
create index if not exists exam_questions_topic on public.exam_questions (topic_id) where is_active;

alter table public.exam_topics enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_options enable row level security;
alter table public.exam_rounds enable row level security;
alter table public.exam_attempts enable row level security;
revoke all on public.exam_topics, public.exam_questions, public.exam_options, public.exam_rounds, public.exam_attempts from anon, authenticated;
grant usage, select on all sequences in schema public to service_role;

-- ความคืบหน้าต่อ (พนักงาน, หัวข้อ) ในรอบ : จำนวนครั้งที่สอบ / ครั้งที่ผ่าน / ผ่านครั้งแรกที่ครั้งที่เท่าไร
create or replace function public.exam_progress(p_round int, p_include_test boolean default false)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb)
  from (
    select rep_code, topic_id,
      count(*)::int as attempts,
      (count(*) filter (where passed))::int as passes,
      min(seq) filter (where passed) as first_pass_no,
      max(percent) as best_percent,
      max(submitted_at) as last_at,
      bool_or(coalesce(passed, false)) as passed
    from exam_attempts
    where round_id = p_round and status = 'submitted' and (p_include_test or not is_test)
    group by rep_code, topic_id
  ) x
$$;
revoke all on function public.exam_progress(int, boolean) from public, anon, authenticated;
grant execute on function public.exam_progress(int, boolean) to service_role;

-- รูปประกอบข้อสอบ
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exam-images', 'exam-images', true, 5242880, array['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
on conflict (id) do nothing;
