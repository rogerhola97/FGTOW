"use client";

import { useMemo, useState } from "react";
import { CUSTOM_PRICE_COEFFICIENTS, EquipmentDefinition, ModelId, ModelMeta, SECOND_AXLE_SURCHARGE, TrailerPreset, money } from "../lib/quoteCatalog";
import { PricingSettings } from "../lib/pricingSettingsShape";

type CoeffFields = "priceBase" | "priceFloor" | "priceWall";
const COEFF_LABEL: Record<CoeffFields, string> = {
  priceBase: "Base fija",
  priceFloor: "Por m² de piso",
  priceWall: "Por m² de pared",
};

// Ejemplo de referencia para que los "diales" de food/cargo no se sientan abstractos: un remolque
// de 2.00 × 3.50 m, 2.10 m de alto, 1 eje.
const EXAMPLE = { widthCm: 200, lengthCm: 350, heightCm: 210 };

function estimatePrice(coeff: Record<CoeffFields, number>) {
  const floorAreaM2 = (EXAMPLE.widthCm / 100) * (EXAMPLE.lengthCm / 100);
  const wallAreaM2 = 2 * (EXAMPLE.widthCm / 100 + EXAMPLE.lengthCm / 100) * (EXAMPLE.heightCm / 100);
  return Math.round(coeff.priceBase + coeff.priceFloor * floorAreaM2 + coeff.priceWall * wallAreaM2);
}

function numOrBlank(value: number | undefined) {
  return value === undefined ? "" : String(value);
}

export function PricingSettingsForm({ initialSettings, equipment, presets, modelMeta }: {
  initialSettings: PricingSettings;
  equipment: EquipmentDefinition[];
  presets: TrailerPreset[];
  modelMeta: Record<ModelId, ModelMeta>;
}) {
  const [includedCount, setIncludedCount] = useState(String(initialSettings.included_equipment_count));
  const [extraPrice, setExtraPrice] = useState(String(initialSettings.extra_equipment_price));
  const [equipmentPrices, setEquipmentPrices] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const item of equipment) map[item.id] = numOrBlank(initialSettings.equipment_price_overrides[item.id]);
    return map;
  });
  const [presetPrices, setPresetPrices] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const preset of presets) map[preset.id] = numOrBlank(initialSettings.trailer_base_price_overrides[preset.id]);
    return map;
  });
  const [coefficients, setCoefficients] = useState<Record<"food" | "cargo", Record<CoeffFields, string>>>(() => {
    const build = (model: "food" | "cargo") => {
      const base = CUSTOM_PRICE_COEFFICIENTS[model];
      const override = initialSettings.custom_coefficient_overrides[model] ?? {};
      const result = {} as Record<CoeffFields, string>;
      (["priceBase", "priceFloor", "priceWall"] as CoeffFields[]).forEach((field) => {
        result[field] = String(override[field] ?? base[field]);
      });
      return result;
    };
    return { food: build("food"), cargo: build("cargo") };
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  const equipmentByModel = useMemo(() => {
    const grouped: Record<ModelId, EquipmentDefinition[]> = { food: [], cargo: [], rzr: [] };
    for (const item of equipment) grouped[item.model].push(item);
    return grouped;
  }, [equipment]);

  async function handleSave() {
    setStatus("saving"); setMessage("");
    try {
      const equipment_price_overrides: Record<string, number> = {};
      for (const [id, raw] of Object.entries(equipmentPrices)) {
        const num = Number(raw);
        if (raw.trim() !== "" && Number.isFinite(num) && num >= 0) equipment_price_overrides[id] = num;
      }
      const trailer_base_price_overrides: Record<string, number> = {};
      for (const [id, raw] of Object.entries(presetPrices)) {
        const preset = presets.find((candidate) => candidate.id === id);
        const linkedToOneAxle = preset?.axles === 2 && presets.some((candidate) => candidate.model === preset.model && candidate.widthCm === preset.widthCm && candidate.lengthCm === preset.lengthCm && candidate.axles === 1);
        if (linkedToOneAxle) continue;
        const num = Number(raw);
        if (raw.trim() !== "" && Number.isFinite(num) && num >= 0) trailer_base_price_overrides[id] = num;
      }
      const custom_coefficient_overrides: Record<string, Partial<Record<CoeffFields, number>>> = {};
      for (const model of ["cargo"] as const) {
        const entry: Partial<Record<CoeffFields, number>> = {};
        for (const field of ["priceBase", "priceFloor", "priceWall"] as CoeffFields[]) {
          const num = Number(coefficients[model][field]);
          if (Number.isFinite(num) && num >= 0) entry[field] = num;
        }
        custom_coefficient_overrides[model] = entry;
      }

      const response = await fetch("/api/vendedor/pricing", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          included_equipment_count: Number(includedCount),
          extra_equipment_price: Number(extraPrice),
          equipment_price_overrides,
          trailer_base_price_overrides,
          custom_coefficient_overrides,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "No fue posible guardar los precios.");
      setStatus("saved"); setMessage("Precios guardados. Aplican a toda cotización nueva o editada desde el panel de vendedor.");
    } catch (error) {
      setStatus("error"); setMessage(error instanceof Error ? error.message : "No fue posible guardar los precios.");
    }
  }

  return (
    <div className="pricing-settings-form">
      <div className="pricing-settings-section">
        <h2>Tarifa plana de aditamentos</h2>
        <p>Se usa en cualquier aditamento sin precio propio abajo, a partir del que ya no va incluido.</p>
        <div className="pricing-settings-row">
          <label>Incluidos gratis<input type="number" min={0} value={includedCount} onChange={(event) => setIncludedCount(event.target.value)} /></label>
          <label>Precio del resto<input type="number" min={0} value={extraPrice} onChange={(event) => setExtraPrice(event.target.value)} /></label>
        </div>
      </div>

      <div className="pricing-settings-section">
        <h2>Remolques RZR (precio fijo)</h2>
        {presets.map((preset) => {
          const matchingOneAxle = preset.axles === 2 ? presets.find((candidate) => candidate.model === preset.model && candidate.widthCm === preset.widthCm && candidate.lengthCm === preset.lengthCm && candidate.axles === 1) : undefined;
          const linkedPrice = matchingOneAxle ? Number(presetPrices[matchingOneAxle.id] || matchingOneAxle.basePrice) + SECOND_AXLE_SURCHARGE : null;
          return <div className="pricing-settings-row" key={preset.id}>
            <label>{preset.label}<input type="number" min={0} disabled={Boolean(matchingOneAxle)} placeholder={String(preset.basePrice)} value={linkedPrice ?? presetPrices[preset.id] ?? ""} onChange={(event) => setPresetPrices((current) => ({ ...current, [preset.id]: event.target.value }))} />{matchingOneAxle && <small>Precio de un eje + $7,000.</small>}</label>
          </div>;
        })}
      </div>

      <div className="pricing-settings-section">
        <h2>{modelMeta.food.shortLabel} · lista sugerida oficial</h2>
        <p>Los precios base se toman de la columna “PRECIO SUGERIDO” del PDF y no se sustituyen con una fórmula editable. Las filas publicadas solo con dos ejes recuperan la base restando $7,000.</p>
        <p>Reglas fijas: cada eje adicional suma $7,000; un largo adicional de 20 a 40 cm suma $4,500 una sola vez; las medidas estándar de cada 50 cm conservan su precio propio.</p>
      </div>

      <div className="pricing-settings-section">
        <h2>{modelMeta.cargo.shortLabel} · fórmula del precio base</h2>
        <p>Cargo conserva su fórmula independiente. También aplica $7,000 por cada eje adicional y $4,500 por un largo adicional de 20 a 40 cm.</p>
        <p>Ejemplo con 2.00 × 3.50 m, 1 eje: <strong>{money(estimatePrice({
          priceBase: Number(coefficients.cargo.priceBase) || 0,
          priceFloor: Number(coefficients.cargo.priceFloor) || 0,
          priceWall: Number(coefficients.cargo.priceWall) || 0,
        }))}</strong></p>
        <div className="pricing-settings-row">
          {(["priceBase", "priceFloor", "priceWall"] as CoeffFields[]).map((field) => (
            <label key={field}>{COEFF_LABEL[field]}<input type="number" min={0} value={coefficients.cargo[field]} onChange={(event) => setCoefficients((current) => ({ ...current, cargo: { ...current.cargo, [field]: event.target.value } }))} /></label>
          ))}
        </div>
      </div>

      {(["food", "cargo", "rzr"] as ModelId[]).map((model) => (
        <div className="pricing-settings-section" key={model}>
          <h2>{modelMeta[model].shortLabel} · aditamentos</h2>
          <div className="pricing-settings-equipment-grid">
            {equipmentByModel[model].map((item) => (
              <label key={item.id}>{item.name}<input type="number" min={0} placeholder="tarifa plana" value={equipmentPrices[item.id] ?? ""} onChange={(event) => setEquipmentPrices((current) => ({ ...current, [item.id]: event.target.value }))} /></label>
            ))}
          </div>
        </div>
      ))}

      <div className="pricing-settings-save">
        <button type="button" className="button" disabled={status === "saving"} onClick={handleSave}>{status === "saving" ? "Guardando…" : "Guardar precios"}</button>
        {message && <p className={`form-status ${status === "error" ? "error" : "sent"}`}>{message}</p>}
      </div>
    </div>
  );
}
