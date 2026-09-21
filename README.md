# Tablet

One human-written text per day. Readers read slowly, answer two probing
questions, then answer the real one: why are you being shown this today?
Every reader gets the same text.

## Running it

```bash
npm install
npm run dev
```

With no Supabase URL set, the app starts in **demo mode**: the whole reading
flow runs from the first sample issue, in memory, with no database and no
Anthropic key. Use it to look at the reading screen.

It is a mockup, not a shortcut. The pipeline order, the hidden thresholds and
the public shapes are the real ones; only the store and the grader are stand
ins, and both live in `src/lib/server/demo.ts` so they are easy to delete.
`min_seconds` is shortened to 4 so the question surfacing can actually be
seen, and `POST /api/demo/reset` clears the store between runs.

`TABLET_DEMO=1` forces demo mode on, `TABLET_DEMO=0` forces it off.

For the real thing:

```bash
cp .env.example .env.local   # fill in Supabase and Anthropic keys
```

Apply the schema to a Supabase project in order:

```
supabase/migrations/0001_init.sql
supabase/migrations/0002_rls.sql
```

Then seed three sample issues, their dossiers, questions, anchor answers and a
starting calibration curve:

```bash
npm run seed
```

The seed schedules issue 1 for today, issue 2 for tomorrow and issue 3 for the
day after.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright flow tests (needs a seeded database) |
| `npm run seed` | Load the three sample issues |

## Layout

```
src/lib/domain/    pure logic, fully unit tested, no I/O
src/lib/server/    grading pipeline, rollover, auth, admin. server only
src/lib/supabase/  browser, request scoped and service role clients
src/components/    the reading screen
src/app/api/       route handlers
supabase/          schema and row level security
scripts/seed.ts    three sample issues
```

`src/lib/domain` holds every rule worth arguing about: day boundaries,
percentiles, thresholds, streaks, integrity checks and the rollover. It has no
database or network access, which is why the tests can cover it end to end.

## The two rules that shape the code

**Never call the Anthropic API from the client.** The grader lives in
`src/lib/server/grader.ts` behind `import "server-only"`, and is reached only
through `POST /api/attempts`.

**Never send pass thresholds or raw scores to the client.** Three things
enforce this:

- `toPublicQuestion` in `src/lib/domain/publish.ts` is the single place a
  question is stripped, and a test asserts the threshold is gone.
- The API routes return `PublicAttempt`, which has a percentile and nothing else.
- `supabase/migrations/0002_rls.sql` revokes column access, so even a reader
  querying Supabase directly cannot read `pass_percentile`, `score` or `rubric`.

## Scoring pipeline

`POST /api/attempts` runs, in order:

1. **Intake.** 25 to 180 words, English, and large single-event insertions are
   blocked on the client and re-checked on the server.
2. **Fingerprint.** A near identical resubmission replays the cached result and
   does not spend a try.
3. **Integrity.** Similarity against an internal pool of AI written answers for
   this text, against other readers' answers today, and against the curator
   note; plus prompt-injection and unseriousness checks. Only `unserious`
   carries a penalty.
4. **Rubric.** Three grader passes with different framings, per axis median.
   Cited quotes are checked against the real text first and a quote the text
   does not contain is reported to the grader, so it earns no evidence credit.
5. **Weights.**

   | Axis | Probe | Why today |
   |---|---|---|
   | Textual evidence | 35% | 25% |
   | Grasp of the argument | 35% | 20% |
   | Connection to the present | 10% | 35% |
   | Originality | 20% | 20% |

6. **Percentile.** Provisional during the day from a calibration curve per
   difficulty; recomputed against the real field at day close. Displayed 1 to 99.

Spelling and grammar are ignored throughout.

### A note on determinism

The spec calls for three deterministic grader passes at temperature 0. The
current Claude models reject `temperature` outright, so determinism is carried
by what remains: fixed prompts, a cached stable prefix per text, and the per
axis median across three differently framed passes. The median is what makes a
single drifting pass harmless, and a pass that fails or is declined is dropped
rather than retried, since two passes still median.

Set `ANTHROPIC_MODEL` to choose a model. It defaults to `claude-opus-5`.

## Day rollover

`POST /api/cron/rollover` recomputes every percentile against the real field,
settles streaks, and rebuilds the calibration curve the next day reads from. It
is idempotent per date and takes `?date=YYYY-MM-DD`. Authorise with
`Authorization: Bearer $ROLLOVER_SECRET`.

`vercel.json` runs it hourly, because a reader's 24 hour window closes at a
different moment in every time zone. On Vercel, set `ROLLOVER_SECRET` to the
same value as `CRON_SECRET`.

## Streaks

- Pass why today: the streak extends
- Sincere miss after three tries: the streak holds
- Unserious flag: the streak breaks
- One freeze earned every 14 days, spent automatically to bridge missed days
- Home time zone changeable once every 30 days
- All timing on server time

A reader who never reaches why today has no outcome for the day, so it counts
as missed and is bridged by a freeze if they have one.

## Admin

`/admin` loads a text with its curator note, angles, key passages, questions
and five anchor answers in one JSON payload. Access is by handle: set
`ADMIN_HANDLES` to a comma separated list. The same payload shape is accepted
by `POST /api/admin/texts`.

Validation enforces the spec's shape: a 60 to 150 word curator note, 3 to 5
angles, exactly 5 anchor answers, exactly 2 probing questions and exactly 1 why
today question, and no question that triggers past the end of the text.

## Testing

`npm test` covers the domain: day boundaries across time zones and daylight
saving, rubric weights and medians, intake, quote checking, fingerprints,
similarity, integrity flags, hidden thresholds, percentiles and calibration,
streak rules including freezes, and the day rollover.

`npm run test:e2e` covers the reading flow and needs a running app against a
seeded database. Point it at one with `PLAYWRIGHT_BASE_URL`.

## Not in the MVP

Chrome extension, community nominations, pairwise voting, tiers, rank scaled
thresholds, Glicko-2 rating, leaderboards, seasons, peer judging, curator
reputation, exploration slot, emergency swaps, reader's hook.
