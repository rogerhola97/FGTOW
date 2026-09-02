import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("contains the complete FG TOW commercial experience", async () => {
  const [home, form, api, schema, foodConfiguratorPage, cargoConfiguratorPage, rzrConfiguratorPage, configurator, quoteApi, quoteCatalog, quoteSchema, mexicanStates] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
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
    readFile(new URL("../app/lib/mexicanStates.ts", import.meta.url), "utf8"),
  ]);
  assert.match(home, /Tu proyecto/);
  assert.match(home, /name: "RZR Sport"/);
  assert.match(home, /name: "Food Truck"/);
  assert.match(home, /name: "Cargo"/);
  assert.match(home, /id="modelos"/);
  assert.doesNotMatch(home, /\/catalogo/);
  assert.match(form, /Solicitar cotización/);
  assert.match(form, /name="state"/);
  assert.match(mexicanStates, /Nuevo León/);
  assert.match(mexicanStates, /Zacatecas/);
  assert.match(api, /rest\/v1\/leads/);
  assert.match(api, /SUPABASE_PUBLISHABLE_KEY/);
  assert.match(schema, /create table if not exists public\.leads/);
  assert.match(schema, /enable row level security/);
  assert.match(foodConfiguratorPage, /TrailerConfigurator modelId="food" plano=\{false\}/);
  assert.match(cargoConfiguratorPage, /TrailerConfigurator modelId="cargo" plano=\{false\}/);
  assert.match(rzrConfiguratorPage, /TrailerConfigurator modelId="rzr" plano=\{false\}/);
  assert.match(configurator, /onPointerMove/);
  assert.match(configurator, /Imprimir cotización/);
  assert.match(configurator, /name="state"/);
  assert.match(configurator, /quote-submit-address/);
  assert.match(configurator, /Elige la medida de tu remolque/);
  assert.match(configurator, /Elige tus accesorios/);
  assert.match(configurator, /Revisa tu cotización/);
  assert.match(configurator, /sendState === "sent"/);
  assert.match(configurator, /Sigue los pasos para configurar tu remolque/);
  assert.match(quoteCatalog, /custom-food-200-300-210-1/);
  assert.match(quoteCatalog, /export function buildCustomPreset/);
  assert.match(quoteCatalog, /export function isValidPresetId/);
  assert.match(quoteCatalog, /model: "cargo"/);
  assert.match(quoteCatalog, /model: "rzr"/);
  assert.match(quoteApi, /contacto@fgtow\.com/);
  assert.match(quoteApi, /api\.resend\.com\/emails/);
  assert.match(quoteApi, /validateLayout/);
  assert.match(quoteApi, /!state/);
  assert.match(quoteSchema, /create table if not exists public\.quotes/);
  assert.match(quoteSchema, /enable row level security/);
  assert.match(quoteSchema, /trailer_length_cm between 200 and 900/);
  assert.match(quoteSchema, /axles in \(1, 2, 3\)/);
  assert.doesNotMatch(home, /SkeletonPreview|codex-preview/);
});
