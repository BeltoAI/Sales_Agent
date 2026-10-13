import { describe, expect, it } from "vitest";
import { basicVerifier } from "./index";

const dnsError = (code: string) => Object.assign(new Error(code), { code });

describe("basic verifier (syntax + MX)", () => {
  const mx = async (domain: string) => {
    if (domain === "acme.com") return [{ exchange: "mx.acme.com", priority: 10 }];
    if (domain === "nullmx.com") return [{ exchange: ".", priority: 0 }];
    if (domain === "flaky.com") throw dnsError("ETIMEOUT");
    throw dnsError("ENOTFOUND");
  };
  const v = basicVerifier(mx);

  it("passing syntax + MX counts as valid", async () => expect((await v.verify("sam@acme.com")).status).toBe("valid"));
  it("bad syntax is invalid", async () => {
    for (const e of ["sam", "sam@", "@acme.com", "sam@acme", "sa m@acme.com", "sam..lee@acme.com"]) {
      expect((await v.verify(e)).status).toBe("invalid");
    }
  });
  it("domains without mail servers are invalid", async () => {
    expect((await v.verify("a@nowhere.test")).status).toBe("invalid");
    expect((await v.verify("a@nullmx.com")).status).toBe("invalid");
  });
  it("demo addresses are never valid", async () => expect((await v.verify("x@example.com")).status).toBe("invalid"));
  it("temporary DNS failures are unknown (not sendable)", async () => expect((await v.verify("a@flaky.com")).status).toBe("unknown"));
});
