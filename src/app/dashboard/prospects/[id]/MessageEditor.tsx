"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Input, Textarea } from "@/ui";
import { MAX_BODY_WORDS, wordCount } from "@/lib/email/rules";
import type { Message } from "@/lib/types";
import { saveMessage } from "../actions";

type FactCheck = { supported?: boolean; unsupported_claims?: string[]; generic?: boolean } | null;

export function MessageEditor({ message }: { message: Message }) {
  const editable = message.status === "draft" || message.status === "scheduled";
  const [subject, setSubject] = useState(message.subject);
  const [body, setBody] = useState(message.body);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const words = wordCount(body);
  const dirty = subject !== message.subject || body !== message.body;
  const fc = message.fact_check as FactCheck;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {fc?.generic ? <Badge tone="info">generic (no research used)</Badge> : <Badge tone="accent">uses research</Badge>}
        {fc && (fc.supported ? <Badge tone="success">fact check passed</Badge> : <Badge tone="danger">fact check failed</Badge>)}
        <span className={words >= MAX_BODY_WORDS ? "text-danger" : "text-muted"}>
          {words} / {MAX_BODY_WORDS - 1} words max
        </span>
      </div>
      <Input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!editable || pending} aria-label="Subject" maxLength={150} />
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} disabled={!editable || pending} rows={7} aria-label="Body" />
      <p className="text-xs text-subtle">The unsubscribe line and your mailing address are added automatically when sent.</p>
      {editable && (
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="secondary"
            disabled={!dirty || pending || words >= MAX_BODY_WORDS}
            onClick={() => start(async () => setResult(await saveMessage(message.id, subject, body)))}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
          {result && <p className={`text-sm ${result.ok ? "text-success" : "text-danger"}`}>{result.message}</p>}
        </div>
      )}
    </div>
  );
}
