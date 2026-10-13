import { describe, expect, it } from "vitest";
import { fetchPage, findAboutUrl, htmlToText } from "./fetch-site";

describe("htmlToText", () => {
  it("drops scripts, styles and tags, decodes entities", () => {
    const html = `<html><head><title>x</title><style>.a{}</style></head><body><script>alert(1)</script>
      <h1>Acme &amp; Co</h1><p>We move&nbsp;freight.</p><!-- hidden --><div>Since 1999 &#8212; &#x2713;</div></body></html>`;
    const text = htmlToText(html);
    expect(text).not.toMatch(/alert|\.a\{\}|hidden|<|title/);
    expect(text).toContain("Acme & Co");
    expect(text).toContain("We move freight.");
    expect(text).toContain("Since 1999 — ✓");
  });
});

describe("findAboutUrl", () => {
  it("prefers same-site about pages", () => {
    const html = `<a href="/pricing">Pricing</a><a href="https://other.com/about">x</a>
      <a href="/company/careers">Company</a><a href="/about-us">About us</a>`;
    expect(findAboutUrl(html, "https://www.acme.com/")).toBe("https://www.acme.com/about-us");
  });
  it("returns null when there is none", () => {
    expect(findAboutUrl(`<a href="/blog">Blog</a>`, "https://acme.com/")).toBeNull();
  });
});

describe("fetchPage safety", () => {
  it.each(["http://127.0.0.1/", "http://localhost/", "http://169.254.169.254/latest/meta-data", "file:///etc/passwd", "ftp://acme.com/", "https://acme.com:8443/", "not a url"])(
    "refuses %s",
    async (url) => expect(await fetchPage(url)).toBeNull(),
  );
});
