-- Row level security, plus column grants that keep hidden mechanics hidden.
-- Readers must never be able to read a pass threshold or a raw score.

alter table users enable row level security;
alter table texts enable row level security;
alter table schedule enable row level security;
alter table dossiers enable row level security;
alter table ai_answer_pool enable row level security;
alter table questions enable row level security;
alter table sessions enable row level security;
alter table attempts enable row level security;
alter table streaks enable row level security;
alter table highlights enable row level security;
alter table calibration_curves enable row level security;
alter table rollovers enable row level security;

-- Own row only.
create policy users_self_select on users for select using (auth.uid() = id);
create policy users_self_update on users for update using (auth.uid() = id);
create policy users_self_insert on users for insert with check (auth.uid() = id);

-- The text of the day is the same for everyone.
create policy texts_read on texts for select to authenticated using (true);
create policy schedule_read on schedule for select to authenticated using (true);
create policy questions_read on questions for select to authenticated using (true);

-- The curator note is part of the reveal, so it is readable. Anchor answers and
-- the AI pool are grading material and stay server side.
create policy dossiers_read on dossiers for select to authenticated using (true);
revoke select on dossiers from authenticated;
grant select (text_id, curator_note) on dossiers to authenticated;

-- No reader-facing policy at all: only the service role touches these.
revoke all on ai_answer_pool from authenticated, anon;
revoke all on calibration_curves from authenticated, anon;
revoke all on rollovers from authenticated, anon;

-- Thresholds are hidden.
revoke select on questions from authenticated;
grant select (id, text_id, kind, "order", prompt, trigger_paragraph, min_seconds, max_tries)
  on questions to authenticated;

create policy sessions_own on sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy highlights_own on highlights for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy streaks_own on streaks for select using (auth.uid() = user_id);

-- Attempts are written only by the server, which holds the service role key.
create policy attempts_own_read on attempts for select using (auth.uid() = user_id);
revoke select on attempts from authenticated;
grant select (id, user_id, question_id, try_no, body, percentile_provisional, percentile_final, created_at)
  on attempts to authenticated;
