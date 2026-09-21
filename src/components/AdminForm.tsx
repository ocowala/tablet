"use client";

import { useState } from "react";

const TEMPLATE = `{
  "text": {
    "issue_no": 1,
    "title": "",
    "author": "",
    "year": null,
    "publication": null,
    "body": ["First paragraph."],
    "difficulty": 3,
    "license": "Public domain",
    "source_url": null
  },
  "schedule_date": null,
  "dossier": {
    "curator_note": "",
    "angles": ["", "", ""],
    "key_passages": [],
    "anchor_answers": [
      { "level": "weak", "body": "" },
      { "level": "fair", "body": "" },
      { "level": "solid", "body": "" },
      { "level": "strong", "body": "" },
      { "level": "exceptional", "body": "" }
    ]
  },
  "questions": [
    { "kind": "probe", "order": 0, "prompt": "", "trigger_paragraph": 2, "min_seconds": 90, "pass_percentile": 40 },
    { "kind": "probe", "order": 1, "prompt": "", "trigger_paragraph": 5, "min_seconds": 90, "pass_percentile": 40 },
    { "kind": "why_today", "order": 0, "prompt": "Why are you being shown this today?", "trigger_paragraph": 8, "min_seconds": 60, "pass_percentile": 45 }
  ],
  "ai_answer_pool": []
}`;

/** Loads texts, curator notes, questions and anchor answers. */
export function AdminForm() {
  const [value, setValue] = useState(TEMPLATE);
  const [problems, setProblems] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setProblems([]);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/texts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: value,
      });
      const payload = (await response.json()) as {
        ok: boolean;
        problems?: string[];
        textId?: string;
      };
      if (payload.ok) setStatus(`Loaded ${payload.textId}`);
      else setProblems(payload.problems ?? ["Could not load that issue."]);
    } catch (error) {
      setProblems([error instanceof Error ? error.message : "Invalid JSON"]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page-pad" style={{ paddingTop: 32, paddingBottom: 64, maxWidth: "52rem", margin: "0 auto" }}>
      <p className="secondary prose-body">Load an issue</p>
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={30}
        spellCheck={false}
        className="mt-4 w-full resize-y bg-transparent outline-none"
        style={{ color: "var(--ink)", fontFamily: "ui-monospace, monospace", fontSize: 13, lineHeight: 1.6 }}
      />
      <div className="mt-4 flex items-center gap-6">
        <button type="button" onClick={submit} disabled={busy} className="tap text-[17px]">
          {busy ? "Loading" : "Load"}
        </button>
        {status ? <span className="secondary text-[15px]">{status}</span> : null}
      </div>
      {problems.length > 0 ? (
        <ul className="mt-4">
          {problems.map((problem, index) => (
            <li key={index} className="secondary text-[15px]">
              {problem}
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
