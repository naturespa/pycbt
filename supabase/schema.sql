-- pycbt: Supabase database schema
-- Run this once from Supabase Dashboard > SQL Editor.
-- All access is intentionally reserved for the Edge Function (service role).

create table if not exists public.exam_sessions (
  student_id text primary key check (student_id ~ '^[0-9]{4}$'),
  grade integer not null check (grade between 1 and 9),
  class_no integer not null check (class_no between 1 and 99),
  attendance integer not null check (attendance between 1 and 99),
  student_name text not null check (char_length(btrim(student_name)) between 1 and 80),
  status text not null check (status in ('active', 'submitted')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  result_json jsonb,
  constraint submitted_session_has_result check (
    (status = 'active' and submitted_at is null)
    or (status = 'submitted' and submitted_at is not null and result_json is not null)
  )
);

create table if not exists public.admin_sessions (
  token_hash text primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.teacher_accounts (
  teacher_id text primary key check (teacher_id ~ '^[A-Za-z0-9_-]{3,40}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_session_actors (
  token_hash text primary key references public.admin_sessions(token_hash) on delete cascade,
  -- "admin" is the initial account backed by TEACHER_PASSWORD, so this is
  -- deliberately not a foreign key to teacher_accounts.
  teacher_id text not null
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  action text not null,
  student_id text,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists exam_sessions_status_idx on public.exam_sessions(status);
create index if not exists admin_sessions_expires_idx on public.admin_sessions(expires_at);
create index if not exists audit_log_student_idx on public.audit_log(student_id, created_at desc);
create index if not exists audit_log_created_idx on public.audit_log(created_at desc);

-- The browser must never call these tables directly.  RLS with no policies
-- blocks the public Data API; the server-side Edge Function retains access.
alter table public.exam_sessions enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.teacher_accounts enable row level security;
alter table public.admin_session_actors enable row level security;
alter table public.audit_log enable row level security;

revoke all on table public.exam_sessions from anon, authenticated;
revoke all on table public.admin_sessions from anon, authenticated;
revoke all on table public.teacher_accounts from anon, authenticated;
revoke all on table public.admin_session_actors from anon, authenticated;
revoke all on table public.audit_log from anon, authenticated;
revoke all on sequence public.audit_log_id_seq from anon, authenticated;
