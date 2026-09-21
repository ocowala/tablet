/**
 * Seeds three sample issues, their dossiers, questions and anchor answers,
 * plus a starting calibration curve. Run with `npm run seed`.
 *
 * The sample texts are short public domain excerpts, abridged for development.
 */
import { createClient } from "@supabase/supabase-js";

import { buildCalibrationCurve } from "../src/lib/domain/percentile";
import { countWords } from "../src/lib/domain/text";

type Seed = {
  text: {
    issue_no: number;
    title: string;
    author: string;
    year: number;
    publication: string | null;
    body: string[];
    difficulty: number;
    license: string;
    source_url: string;
  };
  curator_note: string;
  angles: string[];
  key_passages: string[];
  anchors: { level: string; body: string }[];
  questions: {
    kind: "probe" | "why_today";
    order: number;
    prompt: string;
    trigger_paragraph: number;
    min_seconds: number;
    pass_percentile: number;
    max_tries: number;
  }[];
};

const SEEDS: Seed[] = [
  {
    text: {
      issue_no: 1,
      title: "Where I Lived, and What I Lived For",
      author: "Henry David Thoreau",
      year: 1854,
      publication: "Walden",
      difficulty: 3,
      license: "Public domain",
      source_url: "https://www.gutenberg.org/ebooks/205",
      body: [
        "I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived.",
        "I did not wish to live what was not life, living is so dear; nor did I wish to practise resignation, unless it was quite necessary. I wanted to live deep and suck out all the marrow of life, to live so sturdily and Spartan-like as to put to rout all that was not life, to cut a broad swath and shave close, to drive life into a corner, and reduce it to its lowest terms.",
        "Still we live meanly, like ants; though the fable tells us that we were long ago changed into men. Our life is frittered away by detail. Simplicity, simplicity, simplicity! I say, let your affairs be as two or three, and not a hundred or a thousand.",
        "Why should we live with such hurry and waste of life? We are determined to be starved before we are hungry. Men say that a stitch in time saves nine, and so they take a thousand stitches today to save nine tomorrow.",
        "Let us spend one day as deliberately as Nature, and not be thrown off the track by every nutshell and mosquito's wing that falls on the rails.",
        "Time is but the stream I go a-fishing in. I drink at it; but while I drink I see the sandy bottom and detect how shallow it is. Its thin current slides away, but eternity remains.",
      ],
    },
    curator_note:
      "Thoreau is not telling you to move to a cabin. He is describing a method, and the method is subtraction. He wants to find out what remains of a life once the parts that were merely inherited or merely expected have been taken out of it. The famous sentences are often quoted as encouragement, but read in order they are closer to an experiment with a stated hypothesis and a stated risk. The risk is the one in the first paragraph: arriving at the end and finding that the thing you were living was not life. What he means by deliberately is simply that each part of a day should be chosen rather than absorbed.",
    angles: [
      "Deliberate living as an experiment rather than a mood",
      "Subtraction as the method, not simplicity as an aesthetic",
      "The difference between resignation and choice",
      "Time as something shallower than we treat it",
    ],
    key_passages: [
      "I did not wish to live what was not life, living is so dear",
      "Our life is frittered away by detail",
      "We are determined to be starved before we are hungry",
    ],
    anchors: [
      { level: "weak", body: "Thoreau says life is better in nature and we should all slow down and enjoy things more instead of rushing around all the time. It is a nice message about simplicity and being present in the moment." },
      { level: "fair", body: "He went to the woods to live simply. The argument is that detail eats life, so he wants to reduce his affairs to two or three. The stitch in time line shows he thinks our efficiency is actually panic." },
      { level: "solid", body: "The passage is framed as an experiment with a stated hypothesis. He wants to know what is left of a life after everything unchosen is removed, which is why he says he did not wish to practise resignation. Resignation and deliberate living both look calm from outside, but one is chosen and one is absorbed, and only the chosen one tells him anything." },
      { level: "strong", body: "The test is in the phrase discover that I had not lived. Thoreau is not weighing pleasure against work, he is worried that a life can be fully occupied and still not be a life. That is why the method is subtraction rather than addition: you cannot find the essential facts by adding experiences to a crowded life, only by removing what was never chosen and seeing what still stands. The thousand stitches today to save nine tomorrow is the same point in miniature, effort spent defending against a future rather than living in a present." },
      { level: "exceptional", body: "What makes the passage strange is that the experiment could fail and he says so. Front only the essential facts means he does not yet know what they are, and reduce it to its lowest terms admits the possibility that the lowest terms are very few. The fishing image at the end carries the result: he goes to time expecting depth and detects how shallow it is. So the essay is not a recommendation of country life but a report on an attempt to find out whether a chosen life has more in it than an inherited one, written by someone who found the stream thinner than he hoped and kept fishing anyway." },
    ],
    questions: [
      { kind: "probe", order: 0, prompt: "Thoreau says he did not wish to practise resignation. What is he separating deliberate living from, and how does the text mark the difference?", trigger_paragraph: 1, min_seconds: 75, pass_percentile: 38, max_tries: 2 },
      { kind: "probe", order: 1, prompt: "What does the stitch in time passage claim about how people treat the future?", trigger_paragraph: 3, min_seconds: 60, pass_percentile: 40, max_tries: 2 },
      { kind: "why_today", order: 0, prompt: "Why are you being shown this today?", trigger_paragraph: 5, min_seconds: 45, pass_percentile: 45, max_tries: 3 },
    ],
  },
  {
    text: {
      issue_no: 2,
      title: "Self-Reliance",
      author: "Ralph Waldo Emerson",
      year: 1841,
      publication: "Essays: First Series",
      difficulty: 4,
      license: "Public domain",
      source_url: "https://www.gutenberg.org/ebooks/16643",
      body: [
        "There is a time in every man's education when he arrives at the conviction that envy is ignorance; that imitation is suicide; that he must take himself for better, for worse, as his portion.",
        "Trust thyself: every heart vibrates to that iron string. Accept the place the divine providence has found for you, the society of your contemporaries, the connection of events.",
        "Whoso would be a man must be a nonconformist. He who would gather immortal palms must not be hindered by the name of goodness, but must explore if it be goodness. Nothing is at last sacred but the integrity of your own mind.",
        "The objection to conforming to usages that have become dead to you is that it scatters your force. It loses your time and blurs the impression of your character.",
        "A foolish consistency is the hobgoblin of little minds, adored by little statesmen and philosophers and divines. With consistency a great soul has simply nothing to do.",
        "Speak what you think now in hard words, and tomorrow speak what tomorrow thinks in hard words again, though it contradict every thing you said today.",
      ],
    },
    curator_note:
      "Self-Reliance is quoted more often than it is followed, usually by people who want permission. Emerson is harder than that. He is not saying your first impulse is right; he is saying that a thought you have actually had is worth more to you than a better thought you have only borrowed, because only the first one can be built on. The essay keeps returning to cost. Conformity scatters your force, dead usage blurs your character, and consistency asks you to keep faith with a person you no longer are. Notice how much of the argument is about time rather than courage, and how little of it promises that you will be liked.",
    angles: [
      "Borrowed thought cannot be built on",
      "Conformity described as a cost rather than a sin",
      "Consistency as loyalty to a former self",
      "The difference between trusting yourself and being certain",
    ],
    key_passages: [
      "imitation is suicide",
      "it scatters your force",
      "A foolish consistency is the hobgoblin of little minds",
    ],
    anchors: [
      { level: "weak", body: "Emerson thinks you should be yourself and not copy other people. He says trust yourself and do not care what anyone else thinks about you or your choices." },
      { level: "fair", body: "The essay argues for nonconformity. The line about consistency being a hobgoblin means you should not worry about contradicting yourself, and the part about scattering your force says that going along with dead customs costs you energy." },
      { level: "solid", body: "Emerson frames conformity as expensive rather than wicked. Dead usages scatter your force and blur the impression of your character, so the cost is paid in attention and in who you become. That is why he says imitation is suicide instead of imitation is wrong." },
      { level: "strong", body: "The argument is about what can be built on. A borrowed conviction stays borrowed, so it cannot carry the next thought, which is why he calls imitation suicide rather than laziness. The consistency passage follows from this: keeping yesterday's position is loyalty to a person who has since learned something, and the hard words line asks you to pay the price of that in public, today and again tomorrow." },
      { level: "exceptional", body: "Emerson never promises the self-reliant person is right. Nothing is at last sacred but the integrity of your own mind sets the standard at integrity, not correctness, and explore if it be goodness keeps even goodness under examination. What the essay defends is the only kind of thought that can be revised, because you can only correct a position you actually hold. Borrowed conviction has no handle. Read that way the hobgoblin line is not permission to be careless but a description of the maintenance cost of a mind that is still moving." },
    ],
    questions: [
      { kind: "probe", order: 0, prompt: "Emerson says conformity scatters your force. In his account, what exactly is the cost, and who pays it?", trigger_paragraph: 3, min_seconds: 75, pass_percentile: 42, max_tries: 2 },
      { kind: "probe", order: 1, prompt: "Why does he call imitation suicide rather than error?", trigger_paragraph: 4, min_seconds: 60, pass_percentile: 42, max_tries: 2 },
      { kind: "why_today", order: 0, prompt: "Why are you being shown this today?", trigger_paragraph: 5, min_seconds: 45, pass_percentile: 45, max_tries: 3 },
    ],
  },
  {
    text: {
      issue_no: 3,
      title: "What to the Slave Is the Fourth of July?",
      author: "Frederick Douglass",
      year: 1852,
      publication: "Address at Corinthian Hall, Rochester",
      difficulty: 5,
      license: "Public domain",
      source_url: "https://www.loc.gov/item/16008178/",
      body: [
        "Fellow citizens, pardon me, allow me to ask, why am I called upon to speak here today? What have I, or those I represent, to do with your national independence?",
        "This Fourth of July is yours, not mine. You may rejoice, I must mourn. To drag a man in fetters into the grand illuminated temple of liberty, and call upon him to join you in joyous anthems, were inhuman mockery and sacrilegious irony.",
        "Do you mean, citizens, to mock me, by asking me to speak today? If so, there is a parallel to your conduct. And let me warn you that it is dangerous to copy the example of a nation whose crimes, towering up to heaven, were thrown down by the breath of the Almighty.",
        "What, to the American slave, is your Fourth of July? I answer: a day that reveals to him, more than all other days in the year, the gross injustice and cruelty to which he is the constant victim.",
        "To him, your celebration is a sham; your boasted liberty, an unholy license; your national greatness, swelling vanity.",
        "Would you have me argue that man is entitled to liberty? That he is the rightful owner of his own body? You have already declared it. Must I argue the wrongfulness of slavery? Is that a question for republicans?",
      ],
    },
    curator_note:
      "Douglass was invited to celebrate and answered by refusing the invitation in public, at length, to the people who had offered it. The speech works by taking the audience entirely at their word. He does not argue that liberty is good, because they have already said so, and he will not lower the claim to the level of a debate. That refusal is the argument. Watch how often he turns a shared word back on the room: your Fourth, your celebration, your liberty. The distance between his pronouns and theirs is the whole case, made without a single concession to the idea that the case needed making.",
    angles: [
      "Refusing to argue as a rhetorical act",
      "The pronouns as the structure of the argument",
      "Taking an audience at its own word",
      "Celebration as evidence rather than as occasion",
    ],
    key_passages: [
      "This Fourth of July is yours, not mine",
      "Would you have me argue that man is entitled to liberty?",
      "a day that reveals to him, more than all other days in the year",
    ],
    anchors: [
      { level: "weak", body: "Douglass is saying that the Fourth of July does not mean anything good to enslaved people and that America is being hypocritical about freedom when slavery still exists." },
      { level: "fair", body: "He refuses to celebrate and explains why. The line about the temple of liberty shows he thinks being asked to join in is mockery, and at the end he says he will not argue that slavery is wrong because everyone already knows it." },
      { level: "solid", body: "The speech keeps saying your, not our. That separation carries the argument, because a celebration that only one half of the country can join is evidence about the country rather than an occasion for it. The refusal to argue for liberty is the sharpest part: they have already declared it, so arguing would concede that it was in question." },
      { level: "strong", body: "Douglass takes the audience at their word and lets that do the work. Since they have already declared that a man owns his own body, any argument he offered would pretend the point were open, so he refuses to make one. The holiday becomes evidence instead of occasion: the day reveals injustice more than all other days precisely because it is the day the claim is spoken aloud. The pronouns then measure the distance between what is said and who it covers." },
      { level: "exceptional", body: "The speech is built so that its own existence is the proof. Douglass was invited to perform belonging and instead performs its impossibility, at length, in the room, which means the invitation itself becomes part of what he is describing. Must I argue the wrongfulness of slavery? Is that a question for republicans? sets a trap with no exit: to answer yes is to admit the declaration was empty, to answer no is to admit the country is in breach. He does not resolve it because the unresolved version is the accurate one, and the sham he names is not the celebration but the belief that the two answers could coexist." },
    ],
    questions: [
      { kind: "probe", order: 0, prompt: "Douglass refuses to argue that a man is entitled to liberty. Why is refusing stronger here than arguing?", trigger_paragraph: 3, min_seconds: 90, pass_percentile: 45, max_tries: 2 },
      { kind: "probe", order: 1, prompt: "Track the word your through the speech. What is it doing?", trigger_paragraph: 4, min_seconds: 75, pass_percentile: 45, max_tries: 2 },
      { kind: "why_today", order: 0, prompt: "Why are you being shown this today?", trigger_paragraph: 5, min_seconds: 45, pass_percentile: 48, max_tries: 3 },
    ],
  },
];

function isoDate(offsetDays: number): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + offsetDays);
  return now.toISOString().slice(0, 10);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first");
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  for (const [index, seed] of SEEDS.entries()) {
    const { data: text, error } = await supabase
      .from("texts")
      .upsert(
        {
          ...seed.text,
          word_count: seed.text.body.reduce((total, p) => total + countWords(p), 0),
        },
        { onConflict: "issue_no" },
      )
      .select("id")
      .single();
    if (error) throw error;

    await supabase.from("dossiers").upsert({
      text_id: text.id,
      curator_note: seed.curator_note,
      angles: seed.angles,
      key_passages: seed.key_passages,
      anchor_answers: seed.anchors,
    });

    await supabase.from("questions").delete().eq("text_id", text.id);
    await supabase.from("questions").insert(
      seed.questions.map((question) => ({ ...question, text_id: text.id })),
    );

    // Today, then the next two days.
    await supabase.from("schedule").upsert({ date: isoDate(index), text_id: text.id });
    console.log(`seeded issue ${seed.text.issue_no} for ${isoDate(index)}`);
  }

  // A starting curve so the very first reader still gets a sane percentile.
  const sample = Array.from({ length: 200 }, (_, i) => 20 + (i / 199) * 70);
  for (const difficulty of [1, 2, 3, 4, 5, 6]) {
    const curve = buildCalibrationCurve(difficulty, sample);
    await supabase
      .from("calibration_curves")
      .upsert({ difficulty, points: curve.points, updated_at: new Date().toISOString() });
  }
  console.log("seeded calibration curves");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
