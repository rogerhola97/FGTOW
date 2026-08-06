import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("contains the complete FG TOW commercial experience", async () => {
  const [home, catalog, form, api, schema] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/catalogo/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/LeadForm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/contact/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.match(home, /Tu proyecto/);
  assert.match(home, /name: "RZR Sport"/);
  assert.match(catalog, /model: "Food Pro"/);
  assert.match(form, /Solicitar cotización/);
  assert.match(api, /db\.insert\(leads\)/);
  assert.match(schema, /sqliteTable\("leads"/);
  assert.doesNotMatch(home, /SkeletonPreview|codex-preview/);
});
