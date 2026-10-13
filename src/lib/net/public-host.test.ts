import { describe, expect, it } from "vitest";
import { assertPublicHost, isPrivateIp } from "./public-host";

describe("isPrivateIp", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])(
    "%s is private",
    (ip) => expect(isPrivateIp(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "142.250.0.1", "172.32.0.1", "2607:f8b0:4005::1"])("%s is public", (ip) =>
    expect(isPrivateIp(ip)).toBe(false),
  );
});

describe("assertPublicHost", () => {
  it.each(["localhost", "127.0.0.1", "10.0.0.5", "169.254.169.254", "printer.local", "db.internal", "not a host"])(
    "rejects %s",
    async (host) => expect(assertPublicHost(host)).rejects.toThrow(),
  );
  it("accepts a public IP literal", async () => {
    await expect(assertPublicHost("8.8.8.8")).resolves.toBeUndefined();
  });
});
