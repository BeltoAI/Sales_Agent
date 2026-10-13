"use client";

import { useState, useTransition } from "react";
import { Button, Textarea } from "@/ui";
import { sendReplyDraft } from "./actions";

export function ReplyComposer({ replyId, draft }: { replyId: string; draft: string }) {
  const [body, setBody] = useState(draft);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (result?.ok) return <p className="text-sm text-success">{result.message}</p>;

  return (
    <div className="flex flex-col gap-2">
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} aria-label="Your answer" disabled={pending} />
      <div className="flex items-center gap-3">
        <Button size="sm" disabled={pending || !body.trim()} onClick={() => start(async () => setResult(await sendReplyDraft(replyId, body)))}>
          {pending ? "Sending…" : "Send reply"}
        </Button>
        <span className="text-xs text-muted">Sent from your mailbox, in the same thread, with your footer.</span>
      </div>
      {result && !result.ok && <p className="text-sm text-danger">{result.message}</p>}
    </div>
  );
}
