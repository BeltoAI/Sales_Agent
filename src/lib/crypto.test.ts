import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decrypt, deriveKey, encrypt, masterKey } from "./crypto";

const ORIGINAL = process.env.ENCRYPTION_KEY;

describe("credential encryption (AES-256-GCM)", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
  });
  afterEach(() => {
    process.env.ENCRYPTION_KEY = ORIGINAL;
  });

  it("round-trips a password", () => {
    const enc = encrypt("app-password-123", "user-a");
    expect(enc.startsWith("v1:")).toBe(true);
    expect(enc).not.toContain("app-password-123");
    expect(decrypt(enc, "user-a")).toBe("app-password-123");
  });

  it("uses a fresh IV each time", () => {
    expect(encrypt("same", "user-a")).not.toBe(encrypt("same", "user-a"));
  });

  it("refuses to decrypt for a different owner (AAD)", () => {
    const enc = encrypt("secret", "user-a");
    expect(() => decrypt(enc, "user-b")).toThrow(/Could not decrypt/);
  });

  it("detects tampering", () => {
    const [v, iv, tag, data] = encrypt("secret", "user-a").split(":");
    const flipped = Buffer.from(data, "base64");
    flipped[0] ^= 1;
    expect(() => decrypt([v, iv, tag, flipped.toString("base64")].join(":"), "user-a")).toThrow();
  });

  it("fails with a different key", () => {
    const enc = encrypt("secret", "user-a");
    process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
    expect(() => decrypt(enc, "user-a")).toThrow(/Could not decrypt/);
  });

  it("accepts a 64-char hex key", () => {
    process.env.ENCRYPTION_KEY = randomBytes(32).toString("hex");
    expect(masterKey()).toHaveLength(32);
  });

  it("rejects a missing or short key without printing it", () => {
    process.env.ENCRYPTION_KEY = "";
    expect(() => masterKey()).toThrow(/ENCRYPTION_KEY/);
    process.env.ENCRYPTION_KEY = "c2hvcnQ=";
    expect(() => masterKey()).toThrow(/32 bytes/);
    try {
      masterKey();
    } catch (e) {
      expect(String(e)).not.toContain("c2hvcnQ=");
    }
  });

  it("derives distinct purpose keys", () => {
    expect(deriveKey("unsubscribe").equals(deriveKey("other"))).toBe(false);
    expect(deriveKey("unsubscribe").equals(masterKey())).toBe(false);
  });
});
