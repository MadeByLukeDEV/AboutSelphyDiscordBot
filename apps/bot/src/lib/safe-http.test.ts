import { describe, expect, it } from "vitest";
import { isBlockedAddress, postJson } from "./safe-http";

describe("isBlockedAddress", () => {
  it("blocks local, private, metadata and reserved IPv4 ranges", () => {
    for (const ip of ["127.0.0.1", "0.0.0.0", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "198.18.0.1", "224.0.0.1", "255.255.255.255", "192.0.0.8"]) expect(isBlockedAddress(ip), ip).toBe(true);
  });

  it("allows ordinary public IPv4 addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "100.63.0.1", "93.184.216.34"]) expect(isBlockedAddress(ip), ip).toBe(false);
  });

  it("blocks IPv6 loopback, private, link-local and IPv4-mapped private addresses", () => {
    for (const ip of ["::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "64:ff9b::7f00:1"]) expect(isBlockedAddress(ip), ip).toBe(true);
  });

  it("allows public IPv6 and public mapped addresses", () => {
    expect(isBlockedAddress("2606:4700:4700::1111")).toBe(false);
    expect(isBlockedAddress("::ffff:8.8.8.8")).toBe(false);
  });

  it("treats anything unparseable as blocked", () => {
    for (const bad of ["", "localhost", "1.2.3", "1.2.3.256", "not an ip"]) expect(isBlockedAddress(bad), bad).toBe(true);
  });
});

describe("postJson", () => {
  it("refuses a name that resolves to a private address, without connecting", async () => {
    const lookup = ((_h: string, _o: unknown, cb: (e: null, a: string, f: number) => void) => cb(null, "10.0.0.5", 4)) as never;
    expect(await postJson("https://example.test/hook", "{}", {}, { lookup })).toEqual({ ok: false, reason: "blocked" });
  });

  it("refuses non-https and addresses with credentials", async () => {
    expect(await postJson("http://example.test/hook", "{}", {})).toEqual({ ok: false, reason: "blocked" });
    expect(await postJson("https://user:pw@example.test/hook", "{}", {})).toEqual({ ok: false, reason: "blocked" });
    expect(await postJson("not a url", "{}", {})).toEqual({ ok: false, reason: "error" });
  });
});
