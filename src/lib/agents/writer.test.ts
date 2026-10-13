import { describe, expect, it } from "vitest";
import { formatNotes } from "./researcher";
import { draftProblems, looksLikePlainText } from "./writer";

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

describe("writer draft checks", () => {
  it("accepts short plain-text drafts", () => {
    expect(draftProblems([{ step: 1, subject: "hi", body: words(80) }])).toEqual([]);
  });
  it("rejects 120+ words (must be UNDER 120)", () => {
    expect(draftProblems([{ step: 1, subject: "hi", body: words(119) }])).toEqual([]);
    expect(draftProblems([{ step: 2, subject: "hi", body: words(120) }])[0]).toMatch(/120 words/);
  });
  it("rejects HTML and markdown links", () => {
    expect(looksLikePlainText("Hi <b>Sam</b>")).toBe(false);
    expect(looksLikePlainText("see [site](https://x.com)")).toBe(false);
    expect(looksLikePlainText("Is 3 < 5? Yes.")).toBe(true);
  });
  it("rejects empty subject or body", () => {
    expect(draftProblems([{ step: 3, subject: " ", body: "" }])).toHaveLength(2);
  });
});

describe("research notes", () => {
  it("formats each fact with its source", () => {
    expect(formatNotes([{ fact: "Opened Denver office", source_url: "https://a.com/news" }])).toBe(
      "- Opened Denver office (source: https://a.com/news)",
    );
    expect(formatNotes([])).toBeNull();
  });
});
