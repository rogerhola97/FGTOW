import assert from "node:assert/strict";
import test from "node:test";

import {
  ADDITIONAL_LENGTH_SURCHARGE,
  CUSTOM_NEXT_STANDARD_GAP,
  PDF_TRAILER_PRICE_REFERENCE,
  PRICE_ROUNDING_STEP,
  SECOND_AXLE_SURCHARGE,
  STANDARD_TRAILER_PRICES,
  TRAILER_PRESETS,
  buildCustomPreset,
  buildCustomPresetId,
  calculateQuote,
  defaultWindows,
  getAllowedAxles,
  getCustomLengthOptions,
  getIncludedEquipmentCount,
  getMaxHeightCm,
  getReferenceTwoAxlePrice,
  getSuggestedOneAxlePrice,
  isValidPresetId,
  resolveCustomTrailerPrice,
  validateStandardTrailerPrices,
} from "../app/lib/quoteCatalog.ts";

test("uses exact standard rows and bounds 20/30/40 cm custom lengths", () => {
  assert.equal(SECOND_AXLE_SURCHARGE, 7000);
  assert.equal(ADDITIONAL_LENGTH_SURCHARGE, 4500);
  assert.equal(CUSTOM_NEXT_STANDARD_GAP, 1500);

  assert.equal(buildCustomPreset("food", 200, 200, 210, 1).basePrice, 56000);
  assert.equal(buildCustomPreset("food", 200, 200, 210, 2).basePrice, 62500);
  assert.equal(buildCustomPreset("food", 200, 220, 210, 2).basePrice, 66500);
  assert.equal(buildCustomPreset("food", 200, 230, 210, 2).basePrice, 66500);
  assert.equal(buildCustomPreset("food", 200, 240, 210, 2).basePrice, 68000);
  assert.equal(buildCustomPreset("food", 200, 250, 210, 2).basePrice, 68000);

  assert.equal(buildCustomPreset("food", 180, 220, 210, 1).basePrice, 53000);
  assert.equal(buildCustomPreset("food", 200, 320, 210, 1).basePrice, 73000);
  assert.equal(buildCustomPreset("food", 200, 340, 210, 1).basePrice, 74500);
  assert.equal(buildCustomPreset("food", 200, 420, 210, 1).basePrice, 82500);
});

test("keeps the PDF one- and two-axle rows independent", () => {
  assert.equal(getReferenceTwoAxlePrice(200, 200, "price"), 69020);
  assert.equal(getReferenceTwoAxlePrice(200, 200, "suggested"), 62500);
  assert.equal(getReferenceTwoAxlePrice(220, 250, "price"), 77066);
  assert.equal(getReferenceTwoAxlePrice(220, 250, "suggested"), 69500);

  const unresolved = PDF_TRAILER_PRICE_REFERENCE.find((row) => row.widthCm === 200 && row.lengthCm === 500);
  assert.equal(unresolved?.oneAxlePrice, null);
  assert.equal(unresolved?.oneAxleSuggestedPrice, null);
  assert.equal(getSuggestedOneAxlePrice(200, 500), 99000);
  assert.equal(getReferenceTwoAxlePrice(200, 500, "suggested"), 106000);
});

test("stores long-size references explicitly and preserves technical restrictions", () => {
  assert.equal(getSuggestedOneAxlePrice(200, 600), 106500);
  assert.equal(getSuggestedOneAxlePrice(220, 600), 110500);
  assert.equal(getSuggestedOneAxlePrice(200, 650), 111500);
  assert.equal(getSuggestedOneAxlePrice(220, 650), 115500);
  assert.equal(buildCustomPreset("food", 220, 600, 210, 2).basePrice, 117500);
  assert.equal(buildCustomPreset("food", 220, 670, 210, 3).basePrice, 133000);

  assert.deepEqual(getAllowedAxles(450), [1, 2]);
  assert.deepEqual(getAllowedAxles(490), [2]);
  assert.deepEqual(getAllowedAxles(650), [2]);
  assert.deepEqual(getAllowedAxles(690), [3]);
  assert.equal(getMaxHeightCm(490), 270);
  assert.equal(getMaxHeightCm(500), 300);

  const nearFiveMeters = buildCustomPreset("food", 200, 490, 300, 1);
  assert.equal(nearFiveMeters.axles, 2);
  assert.equal(nearFiveMeters.heightCm, 270);
  const nearSevenMeters = buildCustomPreset("food", 200, 690, 300, 2);
  assert.equal(nearSevenMeters.axles, 3);
  assert.ok(!isValidPresetId("custom-food-200-690-300-2"));
  assert.ok(isValidPresetId("custom-food-200-690-300-3"));
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

test("assigns 2 or 5 included accessories from the priced standard", () => {
  assert.equal(getIncludedEquipmentCount(250), 2);
  assert.equal(getIncludedEquipmentCount(300), 5);
  assert.equal(buildCustomPreset("food", 200, 280, 210, 1).includedEquipment, 2);
  assert.equal(buildCustomPreset("food", 200, 290, 210, 1).includedEquipment, 5);
  assert.equal(buildCustomPreset("food", 200, 300, 210, 1).includedEquipment, 5);
});

test("uses the resolved included count when calculating a public quote", () => {
  const items = [0, 1, 2].map((index) => ({ instanceId: `item-${index}`, typeId: "plancha", xCm: 0, yCm: index * 50, widthCm: 90, depthCm: 50, rotation: 0 }));
  const compactId = buildCustomPresetId("food", 200, 250, 210, 1);
  const publicQuote = calculateQuote(compactId, items, [], false);
  assert.equal(publicQuote.preset.basePrice, 61500);
  assert.equal(publicQuote.preset.includedEquipment, 2);
  assert.equal(publicQuote.extras, 2500);

  const promoted = calculateQuote(buildCustomPresetId("food", 200, 290, 210, 1), items, [], false);
  assert.equal(promoted.preset.includedEquipment, 5);
  assert.equal(promoted.extras, 0);
});

test("validates the standard matrix and every supported custom price", () => {
  assert.deepEqual(validateStandardTrailerPrices(), []);
  for (const row of STANDARD_TRAILER_PRICES) {
    assert.equal(row.standardPrice % PRICE_ROUNDING_STEP, 0, `${row.model} ${row.widthCm}x${row.lengthCm} ${row.axles}e`);
  }

  for (const model of ["food", "cargo"]) {
    for (const widthCm of [180, 200, 220]) {
      for (let lowerLengthCm = 200; lowerLengthCm < 900; lowerLengthCm += 50) {
        if (widthCm === 180 && lowerLengthCm > 200) continue;
        for (const axles of [1, 2, 3]) {
          for (const extension of [20, 30, 40]) {
            const result = resolveCustomTrailerPrice(model, widthCm, lowerLengthCm + extension, 210, axles);
            assert.ok(result, `${model} ${widthCm}x${lowerLengthCm + extension} ${axles}e`);
            assert.ok(result.price >= result.lowerPrice);
            assert.ok(result.price <= result.upperPrice);
            assert.equal(result.price % PRICE_ROUNDING_STEP, 0);
            if (extension < 40) assert.ok(result.price <= result.upperPrice - CUSTOM_NEXT_STANDARD_GAP);
            else assert.equal(result.price, result.upperPrice);
          }
        }
      }
    }
  }
});

test("links the matching RZR double axle preset to the one-axle base", () => {
  const oneAxle = TRAILER_PRESETS.find((preset) => preset.id === "rz-194-360");
  const twoAxles = TRAILER_PRESETS.find((preset) => preset.id === "rz-194-360-2e");
  assert.equal(twoAxles?.basePrice, (oneAxle?.basePrice ?? 0) + SECOND_AXLE_SURCHARGE);
});

test("sizes and centers public food-trailer windows proportionally", () => {
  const compact = defaultWindows("back", 200, 300, 210);
  const compactLeft = compact.find((window) => window.wall === "left");
  const compactFront = compact.find((window) => window.wall === "front");
  assert.deepEqual(
    { widthCm: compactLeft?.widthCm, heightCm: compactLeft?.heightCm, offsetCm: compactLeft?.offsetCm },
    { widthCm: 135, heightCm: 74, offsetCm: 82.5 },
  );
  assert.deepEqual(
    { widthCm: compactFront?.widthCm, heightCm: compactFront?.heightCm, offsetCm: compactFront?.offsetCm },
    { widthCm: 100, heightCm: 59, offsetCm: 50 },
  );

  const long = defaultWindows("back", 220, 600, 240);
  const longLeft = long.find((window) => window.wall === "left");
  const longFront = long.find((window) => window.wall === "front");
  assert.deepEqual(
    { widthCm: longLeft?.widthCm, heightCm: longLeft?.heightCm, offsetCm: longLeft?.offsetCm },
    { widthCm: 270, heightCm: 84, offsetCm: 165 },
  );
  assert.deepEqual(
    { widthCm: longFront?.widthCm, heightCm: longFront?.heightCm, offsetCm: longFront?.offsetCm },
    { widthCm: 110, heightCm: 67, offsetCm: 55 },
  );
});
