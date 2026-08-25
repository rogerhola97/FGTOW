import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("contains the complete FG TOW commercial experience", async () => {
  const [home, catalog, form, api, schema, foodConfiguratorPage, cargoConfiguratorPage, rzrConfiguratorPage, configurator, quoteApi, quoteCatalog, quoteSchema] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/catalogo/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/LeadForm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/contact/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/leads.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/cotizador/food/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/cotizador/cargo/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/cotizador/rzr/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/TrailerConfigurator.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/quote/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/quoteCatalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/quotes.sql", import.meta.url), "utf8"),
  ]);
  assert.match(home, /Tu proyecto/);
  assert.match(home, /name: "RZR Sport"/);
  assert.match(catalog, /title: "FG Food Truck"/);
  assert.match(catalog, /title: "FG Cargo"/);
  assert.match(catalog, /title: "FG RZR Sport"/);
  assert.doesNotMatch(catalog, /price|size:/);
  assert.match(form, /Solicitar cotización/);
  assert.match(api, /rest\/v1\/leads/);
  assert.match(api, /SUPABASE_PUBLISHABLE_KEY/);
  assert.match(schema, /create table if not exists public\.leads/);
  assert.match(schema, /enable row level security/);
  assert.match(foodConfiguratorPage, /TrailerConfigurator modelId="food"/);
  assert.match(cargoConfiguratorPage, /TrailerConfigurator modelId="cargo"/);
  assert.match(rzrConfiguratorPage, /TrailerConfigurator modelId="rzr"/);
  assert.match(configurator, /onPointerMove/);
  assert.match(configurator, /Guardar cotización en PDF/);
  assert.match(quoteCatalog, /ft-200-300/);
  assert.match(quoteCatalog, /basePrice: 69000/);
  assert.match(quoteCatalog, /model: "cargo"/);
  assert.match(quoteCatalog, /model: "rzr"/);
  assert.match(quoteApi, /contacto@fgtow\.com/);
  assert.match(quoteApi, /api\.resend\.com\/emails/);
  assert.match(quoteApi, /validateLayout/);
  assert.match(quoteSchema, /create table if not exists public\.quotes/);
  assert.match(quoteSchema, /enable row level security/);
  assert.doesNotMatch(home, /SkeletonPreview|codex-preview/);
});
