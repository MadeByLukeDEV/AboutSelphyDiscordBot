import { describe, expect, it } from "vitest";
import { getText, isBlockedAddress, postJson } from "./safe-http";

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

// A resolver that answers the way Node's resolver does: a list when asked for all addresses, one address otherwise.
const resolverOf = (...addresses: string[]) =>
  ((_h: string, o: { all?: boolean }, cb: (...a: unknown[]) => void) => {
    const list = addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
    return o.all ? cb(null, list) : cb(null, list[0]!.address, list[0]!.family);
  }) as never;

describe("postJson", () => {
  it("refuses a name that resolves to a private address, without connecting", async () => {
    const lookup = resolverOf("10.0.0.5");
    expect(await postJson("https://example.test/hook", "{}", {}, { lookup })).toEqual({ ok: false, reason: "blocked" });
  });

  it("refuses non-https and addresses with credentials", async () => {
    expect(await postJson("http://example.test/hook", "{}", {})).toEqual({ ok: false, reason: "blocked" });
    expect(await postJson("https://user:pw@example.test/hook", "{}", {})).toEqual({ ok: false, reason: "blocked" });
    expect(await postJson("not a url", "{}", {})).toEqual({ ok: false, reason: "error" });
  });
});

describe("getText", () => {
  const privateLookup = resolverOf("10.0.0.5");

  it("refuses a public-looking name that resolves to a private address", async () => {
    expect(await getText("https://feeds.example.test/rss", { lookup: privateLookup })).toEqual({ ok: false, reason: "blocked", detail: "address" });
  });

  it("refuses plain http, credentials and unknown schemes for hosts that are not on the internal list", async () => {
    expect(await getText("http://feeds.example.test/rss")).toEqual({ ok: false, reason: "blocked", detail: "http" });
    expect(await getText("https://u:p@feeds.example.test/rss")).toEqual({ ok: false, reason: "blocked", detail: "login in url" });
    expect(await getText("ftp://feeds.example.test/rss", { internalHosts: ["feeds.example.test"] })).toEqual({ ok: false, reason: "blocked", detail: "scheme" });
    expect(await getText("http://rsshub:1200/x", { internalHosts: ["other"] })).toEqual({ ok: false, reason: "blocked", detail: "http" });
    expect(await getText("not a url")).toEqual({ ok: false, reason: "error" });
  });
});

describe("the connect-time check answers the shape Node asks for", () => {
  it("blocks a name when ANY of its addresses is private (a public one next to a private one is still refused)", async () => {
    expect(await getText("https://feeds.example.test/rss", { lookup: resolverOf("93.184.216.34", "10.0.0.5") })).toEqual({ ok: false, reason: "blocked", detail: "address" });
    expect(await getText("https://feeds.example.test/rss", { lookup: resolverOf("::1") })).toEqual({ ok: false, reason: "blocked", detail: "address" });
  });

  it("does not report a resolver failure as a block", async () => {
    const failing = ((_h: string, _o: unknown, cb: (e: Error) => void) => cb(Object.assign(new Error("nx"), { code: "ENOTFOUND" }))) as never;
    const result = await getText("https://feeds.example.test/rss", { lookup: failing });
    expect(result.ok).toBe(false);
    expect(result).not.toMatchObject({ reason: "blocked" });
  });
});

describe("addresses typed as raw IPs never reach DNS, so they are checked directly", () => {
  const never = (() => {
    throw new Error("the lookup must not run for a blocked literal");
  }) as never;

  it("refuses private, loopback and metadata IP addresses without connecting", async () => {
    for (const url of ["https://169.254.169.254/latest/meta-data/", "https://10.0.0.5/x", "https://127.0.0.1/x", "https://[::1]/x", "https://[::ffff:10.0.0.5]/x", "https://192.168.1.1/x"]) {
      expect(await getText(url, { lookup: never }), url).toEqual({ ok: false, reason: "blocked", detail: "address" });
      expect(await postJson(url, "{}", {}, { lookup: never }), url).toEqual({ ok: false, reason: "blocked" });
    }
  });
});
