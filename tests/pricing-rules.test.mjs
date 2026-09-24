import assert from "node:assert/strict";
import test from "node:test";

import {
  ADDITIONAL_LENGTH_SURCHARGE,
  PDF_TRAILER_PRICE_REFERENCE,
  SECOND_AXLE_SURCHARGE,
  TRAILER_PRESETS,
  buildCustomPreset,
  getCustomLengthOptions,
  getReferenceTwoAxlePrice,
  getSuggestedOneAxlePrice,
  isValidPresetId,
} from "../app/lib/quoteCatalog.ts";

test("applies the fixed axle and additional-length charges", () => {
  assert.equal(SECOND_AXLE_SURCHARGE, 7000);
  assert.equal(ADDITIONAL_LENGTH_SURCHARGE, 4500);

  assert.equal(buildCustomPreset("food", 200, 200, 210, 1).basePrice, 56000);
  assert.equal(buildCustomPreset("food", 200, 200, 210, 2).basePrice, 63000);
  assert.equal(buildCustomPreset("food", 200, 220, 210, 2).basePrice, 67500);
  assert.equal(buildCustomPreset("food", 200, 230, 210, 2).basePrice, 67500);
  assert.equal(buildCustomPreset("food", 200, 240, 210, 2).basePrice, 67500);

  // 2.50 m is its own standard row, not a 50 cm extension of 2.00 m.
  assert.equal(buildCustomPreset("food", 200, 250, 210, 2).basePrice, 68500);
});

test("keeps both PDF series separate and derives two axles from one axle", () => {
  assert.equal(getReferenceTwoAxlePrice(200, 200, "price"), 68520);
  assert.equal(getReferenceTwoAxlePrice(200, 200, "suggested"), 63000);
  assert.equal(getReferenceTwoAxlePrice(220, 250, "price"), 76566);
  assert.equal(getReferenceTwoAxlePrice(220, 250, "suggested"), 72000);

  const unresolved = PDF_TRAILER_PRICE_REFERENCE.find((row) => row.widthCm === 200 && row.lengthCm === 500);
  assert.equal(unresolved?.oneAxlePrice, null);
  assert.equal(unresolved?.oneAxleSuggestedPrice, null);
  assert.equal(getSuggestedOneAxlePrice(200, 500), 99000);
  assert.equal(getReferenceTwoAxlePrice(200, 500, "suggested"), 106000);
});

test("extends the suggested list with stable long-size increments", () => {
  assert.equal(getSuggestedOneAxlePrice(200, 600), 106500);
  assert.equal(getSuggestedOneAxlePrice(220, 600), 110500);
  assert.equal(getSuggestedOneAxlePrice(200, 650), 111500);
  assert.equal(getSuggestedOneAxlePrice(220, 650), 115500);
  assert.equal(buildCustomPreset("food", 220, 600, 210, 2).basePrice, 117500);
  assert.equal(buildCustomPreset("food", 220, 670, 210, 3).basePrice, 134000);
});

test("uses the complete normalized suggested-price series", () => {
  const expectedOneAxlePrices = [
    [180, 200, 50500], [180, 250, 54500],
    [200, 200, 56000], [200, 250, 61500], [200, 300, 69500], [200, 350, 74500],
    [200, 400, 80500], [200, 450, 84000], [200, 500, 99000], [200, 550, 104500],
    [220, 200, 60500], [220, 250, 65000], [220, 300, 73000], [220, 350, 77000],
    [220, 400, 84000], [220, 450, 89000], [220, 500, 103500], [220, 550, 108000],
    [220, 600, 110500],
  ];
  for (const [widthCm, lengthCm, expected] of expectedOneAxlePrices) {
    assert.equal(getSuggestedOneAxlePrice(widthCm, lengthCm), expected, `${widthCm} × ${lengthCm}`);
  }
});

test("offers only standard lengths or the supported 20 to 40 cm extensions", () => {
  const options = getCustomLengthOptions();
  for (const length of [200, 220, 230, 240, 250, 270, 280, 290, 300]) assert.ok(options.includes(length));
  assert.ok(!options.includes(210));
  assert.ok(isValidPresetId("custom-food-200-220-210-2"));
  assert.ok(!isValidPresetId("custom-food-200-210-210-2"));
  assert.ok(isValidPresetId("custom-food-200-500-210-2"));
  assert.ok(isValidPresetId("custom-cargo-200-500-210-2"));
});

test("links the matching RZR double axle preset to the one-axle base", () => {
  const oneAxle = TRAILER_PRESETS.find((preset) => preset.id === "rz-194-360");
  const twoAxles = TRAILER_PRESETS.find((preset) => preset.id === "rz-194-360-2e");
  assert.equal(twoAxles?.basePrice, (oneAxle?.basePrice ?? 0) + SECOND_AXLE_SURCHARGE);
});
