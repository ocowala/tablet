-- Tablet: core schema.

create extension if not exists "pgcrypto";

create type question_kind as enum ('probe', 'why_today');

create table if not exists users (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text unique not null,
  home_timezone text not null default 'UTC',
  timezone_changed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists texts (
  id uuid primary key default gen_random_uuid(),
  issue_no integer unique not null,
  title text not null,
  author text not null,
  year integer,
  publication text,
  body jsonb not null,               -- array of paragraph strings
  word_count integer not null,
  difficulty smallint not null check (difficulty between 1 and 6),
  license text not null,
  source_url text,
  created_at timestamptz not null default now()
);

create table if not exists schedule (
  date date primary key,
  text_id uuid not null references texts (id) on delete restrict
);

create table if not exists dossiers (
  text_id uuid primary key references texts (id) on delete cascade,
  curator_note text not null,
  angles jsonb not null default '[]'::jsonb,          -- 3 to 5 strings
  key_passages jsonb not null default '[]'::jsonb,
  anchor_answers jsonb not null default '[]'::jsonb   -- 5 of { level, body }
);

-- Internal pool of AI written answers, used only by the integrity checks.
create table if not exists ai_answer_pool (
  id uuid primary key default gen_random_uuid(),
  text_id uuid not null references texts (id) on delete cascade,
  kind question_kind not null,
  body text not null
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  text_id uuid not null references texts (id) on delete cascade,
  kind question_kind not null,
  "order" smallint not null,
  prompt text not null,
  trigger_paragraph integer not null default 0,
  min_seconds integer not null default 60,
  pass_percentile smallint not null default 40,
  max_tries smallint not null default 2,
  unique (text_id, kind, "order")
);

create table if not exists sessions (
  user_id uuid not null references users (id) on delete cascade,
  date date not null,
  text_id uuid not null references texts (id) on delete cascade,
  scroll_progress real not null default 0,
  last_paragraph integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, date)
);

create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  question_id uuid not null references questions (id) on delete cascade,
  try_no smallint not null,
  body text not null,
  fingerprint text not null,
  rubric jsonb,
  score real,
  percentile_provisional smallint,
  percentile_final smallint,
  flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, question_id, try_no)
);

create index if not exists attempts_question_idx on attempts (question_id);
create index if not exists attempts_fingerprint_idx on attempts (user_id, fingerprint);

create table if not exists streaks (
  user_id uuid primary key references users (id) on delete cascade,
  current integer not null default 0,
  best integer not null default 0,
  last_passed_date date,
  freezes_available integer not null default 0,
  last_freeze_awarded_date date
);

create table if not exists highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  text_id uuid not null references texts (id) on delete cascade,
  paragraph integer not null,
  "start" integer not null,
  "end" integer not null,
  color text not null default 'yellow' check (color in ('yellow', 'blue')),
  created_at timestamptz not null default now()
);

create index if not exists highlights_user_text_idx on highlights (user_id, text_id);

-- Provisional percentiles are read off a curve per difficulty, rebuilt at day close.
create table if not exists calibration_curves (
  difficulty smallint primary key check (difficulty between 1 and 6),
  points jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Day close bookkeeping, so a rollover is never applied twice.
create table if not exists rollovers (
  date date primary key,
  ran_at timestamptz not null default now(),
  attempts_scored integer not null default 0,
  readers_settled integer not null default 0
);
