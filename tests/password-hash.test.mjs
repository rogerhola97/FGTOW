import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "../app/lib/passwordHash.mjs";

// Guards against app/lib/vendorAuth.ts (Cloudflare Workers) and scripts/create-vendor.mjs (plain
// Node) ever hashing/verifying vendor passwords differently — both import this same module, so a
// round trip through it is a round trip through the exact code both call sites run.
test("hashPassword/verifyPassword round-trip with a fresh random salt", async () => {
  const { hash, salt } = await hashPassword("Fgtow2026");
  assert.equal(salt.length, 32, "16-byte salt should be 32 hex chars");
  assert.equal(hash.length, 64, "256-bit hash should be 64 hex chars");
  assert.equal(await verifyPassword("Fgtow2026", salt, hash), true);
});

test("verifyPassword rejects a wrong password against the same salt/hash", async () => {
  const { hash, salt } = await hashPassword("Fgtow2026");
  assert.equal(await verifyPassword("wrong-password", salt, hash), false);
});

test("verifyPassword is stable against a hash generated from a known salt (no drift over time)", async () => {
  const knownSalt = "0123456789abcdef0123456789abcdef";
  const { hash } = await hashPassword("Fgtow2026", knownSalt.slice(0, 32));
  assert.equal(await verifyPassword("Fgtow2026", knownSalt.slice(0, 32), hash), true);
  assert.equal(await verifyPassword("Fgtow2026", knownSalt.slice(0, 32), "0".repeat(64)), false);
});
