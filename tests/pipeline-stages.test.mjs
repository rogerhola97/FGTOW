import assert from "node:assert/strict";
import test from "node:test";

import { canIssueInvoiceLetter } from "../app/lib/pipelineStages.ts";

test("only allows issuing the invoice letter after full payment", () => {
  assert.equal(canIssueInvoiceLetter("cotizacion"), false);
  assert.equal(canIssueInvoiceLetter("produccion"), false);
  assert.equal(canIssueInvoiceLetter("anticipo"), false);
  assert.equal(canIssueInvoiceLetter("pagada"), true);
  assert.equal(canIssueInvoiceLetter("entregada"), true);
});
