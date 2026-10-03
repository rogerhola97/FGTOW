import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright";

let server, browser, origin;
test.before(async () => {
  const bundled = await build({ configFile: false, logLevel: "error", plugins: [react()], define: { "process.env.NODE_ENV": '"production"' }, build: {
    write: false, minify: false, lib: { entry: resolve("tests/fixtures/vendor-ai-assistant.tsx"), formats: ["iife"], name: "VendorAiHarness" },
  } });
  const output = (Array.isArray(bundled) ? bundled : [bundled]).flatMap(result => result.output);
  const assets = new Map(output.map(entry => ["/" + entry.fileName, entry.type === "chunk" ? entry.code : entry.source]));
  const script = output.find(entry => entry.type === "chunk").fileName;
  const css = output.filter(entry => entry.fileName.endsWith(".css")).map(entry => `<link rel="stylesheet" href="/${entry.fileName}">`).join("");
  const logo = await readFile(new URL("../public/fg-tow-logo.png", import.meta.url));
  server = createServer((request, response) => {
    const url = request.url;
    if (url === "/") { response.setHeader("Content-Type", "text/html; charset=utf-8"); response.end(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${css}</head><body><div id="root"></div><script src="/${script}"></script></body></html>`); }
    else if (url === "/fg-tow-logo.png") { response.setHeader("Content-Type", "image/png"); response.end(logo); }
    else if (assets.has(url)) { response.setHeader("Content-Type", url.endsWith(".css") ? "text/css" : "application/javascript"); response.end(assets.get(url)); }
    else { response.statusCode = 404; response.end(); } // Never forwards any request to production.
  });
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  origin = `http://127.0.0.1:${server.address().port}`;
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (process.platform === "win32" && [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe",
  ].find(path => existsSync(path))) || undefined;
  browser = await chromium.launch({ headless: true, executablePath });
});
test.after(async () => { await browser?.close(); if (server) await new Promise(done => server.close(done)); });

async function fixture(t, handler = async route => route.fulfill({ json: { ok: true, message: "Respuesta de FG TOW.", usage: { totalTokens: 12345 } } }), viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport });
  t.after(() => context.close());
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === "/api/ai/sales") return handler(route);
    return route.continue();
  });
  const page = await context.newPage();
  const scriptErrors = [];
  page.on("pageerror", error => scriptErrors.push(error.message));
  t.after(() => assert.deepEqual(scriptErrors, [], "No browser runtime errors"));
  await page.goto(origin);
  await page.getByRole("button", { name: "Asistente FG TOW", exact: true }).waitFor({ timeout: 5000 });
  return page;
}
const open = page => page.getByRole("button", { name: "Asistente FG TOW", exact: true }).click();
const input = page => page.getByRole("textbox", { name: "Tu consulta" });
const answer = page => page.locator(".vendor-ai-message.is-assistant").last();

test("assistant opens, closes with Escape/button and restores focus without losing local messages", async t => {
  const page = await fixture(t);
  assert.equal(await page.getByRole("dialog").count(), 0);
  await open(page);
  assert.equal(await input(page).evaluate(element => element === document.activeElement), true);
  assert.match(await page.getByRole("log").textContent(), /Hola\. Soy el asistente de ventas/);
  assert.equal(await page.getByRole("log").evaluate(element => element.scrollTop), 0);
  await input(page).fill("Mi consulta"); await input(page).press("Enter");
  await answer(page).getByText("Respuesta de FG TOW.").waitFor();
  await input(page).press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(await page.getByRole("button", { name: "Asistente FG TOW", exact: true }).evaluate(element => element === document.activeElement), true);
  await open(page); assert.match(await page.getByRole("log").textContent(), /Mi consulta/);
  await page.getByRole("button", { name: "Cerrar asistente", exact: true }).click();
  assert.equal(await page.getByRole("dialog").count(), 0);
});

test("suggestions send only the message and null quote ID, rendering safe Markdown without usage", async t => {
  const requests = [];
  const text = "**Sin IVA**\nTotal: $54,500\n\n- Anticipo: $27,250\n- Saldo: $27,250\n\n1. Primera opción\n2. Segunda opción\n<script>window.compromised=true</script><img src=x onerror=alert(1)>";
  const page = await fixture(t, async route => {
    requests.push({ method: route.request().method(), body: route.request().postDataJSON(), headers: route.request().headers() });
    await route.fulfill({ json: { ok: true, message: text, usage: { totalTokens: 12345 } } });
  });
  await open(page); await page.getByRole("button", { name: "¿Cuánto cuesta el Compact 250?" }).click();
  await answer(page).locator("strong").getByText("Sin IVA").waitFor();
  assert.equal(await answer(page).locator("ul li").count(), 2); assert.equal(await answer(page).locator("ol li").count(), 2);
  assert.match(await answer(page).textContent(), /<script>/);
  assert.equal(await answer(page).locator("script,img").count(), 0);
  assert.equal(await page.evaluate(() => window.compromised), undefined);
  assert.doesNotMatch(await page.getByRole("dialog").textContent(), /12345|totalTokens/);
  assert.equal(requests.length, 1); assert.equal(requests[0].method, "POST");
  assert.deepEqual(requests[0].body, { message: "¿Cuánto cuesta el Compact 250?", quoteId: null });
  assert.equal(requests[0].headers["content-type"], "application/json");
});

test("loading blocks simultaneous submits and restores focus after the answer", async t => {
  let calls = 0, release;
  const gate = new Promise(done => { release = done; });
  const page = await fixture(t, async route => { calls++; await gate; await route.fulfill({ json: { ok: true, message: "Listo." } }); });
  await open(page); await input(page).fill("Precio Compact 250");
  await page.locator(".vendor-ai-composer").evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
  await page.getByText("Consultando FG TOW...").waitFor();
  assert.equal(await input(page).isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Enviar", exact: false }).isDisabled(), true);
  assert.equal(calls, 1); release();
  await answer(page).getByText("Listo.").waitFor();
  assert.equal(await input(page).isDisabled(), false);
  assert.equal(await input(page).evaluate(element => element === document.activeElement), true);
});

test("HTTP, invalid JSON, malformed responses and network errors stay sanitized and allow retry", async t => {
  for (const failure of [
    route => route.fulfill({ status: 502, json: { ok: false, error: { code: "PRIVATE_CODE", message: "PRIVATE_STACK secret" } } }),
    route => route.fulfill({ contentType: "application/json", body: "PRIVATE_INVALID_JSON" }),
    route => route.fulfill({ json: { ok: true, usage: { totalTokens: 12345 } } }),
    route => route.abort(),
  ]) {
    const page = await fixture(t, failure); await open(page); await input(page).fill("Consulta fallida"); await input(page).press("Enter");
    await page.getByRole("alert").waitFor();
    assert.equal(await page.getByRole("alert").textContent(), "No pude completar la consulta. Intenta nuevamente.");
    assert.doesNotMatch(await page.getByRole("dialog").textContent(), /PRIVATE_|secret|12345/);
    assert.equal(await input(page).inputValue(), "Consulta fallida");
    assert.equal(await input(page).isDisabled(), false);
  }
});

test("copy writes only the response text and resets its temporary feedback", async t => {
  const page = await fixture(t);
  await page.evaluate(() => { Object.defineProperty(navigator, "clipboard", { value: { writeText: async text => { window.copiedText = text; } }, configurable: true }); });
  await open(page); await input(page).fill("Mensaje para cliente"); await input(page).press("Enter"); await answer(page).getByText("Respuesta de FG TOW.").waitFor();
  await answer(page).getByRole("button", { name: /Copiar respuesta/ }).click();
  await answer(page).getByText("Copiado", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.copiedText), "Respuesta de FG TOW.");
  await answer(page).getByText("Copiar", { exact: true }).waitFor();
});

test("new conversation clears only local state and ignores an abandoned response", async t => {
  let calls = 0, release;
  const gate = new Promise(done => { release = done; });
  const page = await fixture(t, async route => {
    calls++; if (calls === 1) { await gate; try { await route.fulfill({ json: { ok: true, message: "Respuesta abandonada" } }); } catch {} }
    else await route.fulfill({ json: { ok: true, message: "Nueva respuesta" } });
  });
  await open(page); await input(page).fill("Primera consulta"); await input(page).press("Enter"); await page.getByText("Consultando FG TOW...").waitFor();
  await page.getByRole("button", { name: "Nueva conversación" }).click();
  assert.equal(await page.locator(".vendor-ai-message").count(), 1);
  assert.equal(await input(page).inputValue(), ""); assert.equal(await input(page).isDisabled(), false);
  release(); await input(page).fill("Segunda consulta"); await input(page).press("Enter"); await answer(page).getByText("Nueva respuesta").waitFor();
  assert.doesNotMatch(await page.getByRole("log").textContent(), /Primera consulta|Respuesta abandonada/);
  assert.equal(calls, 2);
});

test("input enforces 4000 characters, blocks blanks and supports Shift+Enter", async t => {
  const requests = [];
  const page = await fixture(t, async route => { requests.push(route.request().postDataJSON()); await route.fulfill({ json: { ok: true, message: "Recibido." } }); });
  await open(page); await input(page).fill("   "); await input(page).press("Enter"); assert.equal(requests.length, 0);
  await input(page).fill("Primera línea"); await input(page).press("Shift+Enter"); await input(page).pressSequentially("Segunda línea");
  assert.match(await input(page).inputValue(), /Primera línea\nSegunda línea/); assert.equal(requests.length, 0);
  await input(page).press("Enter"); await answer(page).getByText("Recibido.").waitFor();
  assert.equal(requests[0].message, "Primera línea\nSegunda línea");
  assert.equal(await input(page).getAttribute("maxlength"), "4000");
  await input(page).fill("x".repeat(4001)); assert.equal((await input(page).inputValue()).length, 4000);
  await input(page).press("Enter"); await page.waitForFunction(() => !document.querySelector("textarea").disabled);
  assert.equal(requests[1].message.length, 4000);
  assert.deepEqual(Object.keys(requests[1]), ["message", "quoteId"]);
});

test("desktop, tablet and mobile layouts fit the viewport and keep navigation visible", async t => {
  await mkdir("outputs/vendor-ai", { recursive: true });
  for (const [name, width, height] of [["desktop", 1440, 900], ["tablet", 768, 1024], ["mobile", 390, 844], ["small-mobile", 320, 568]]) {
    const page = await fixture(t, undefined, { width, height });
    const originalWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    await open(page);
    const box = await page.getByRole("dialog").boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width); assert.ok(box.y >= 88 && box.y + box.height <= height);
    if (name === "desktop") assert.ok(box.width >= 380 && box.width <= 430);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), originalWidth, `${name} preserves the page width`);
    assert.equal(await page.getByRole("dialog").evaluate(element => element.scrollWidth <= element.clientWidth), true, `${name} panel has no horizontal overflow`);
    assert.ok((await page.getByRole("log").boundingBox()).height >= 100, `${name} retains a usable transcript`);
    assert.equal(await input(page).isVisible(), true);
    await page.screenshot({ path: `outputs/vendor-ai/${name}.png`, fullPage: true });
  }
});
