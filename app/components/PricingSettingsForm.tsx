"use client";

import { useMemo, useState } from "react";
import { EquipmentDefinition, MODEL_META, ModelId } from "../lib/quoteCatalog";
import { PricingSettings } from "../lib/pricingSettingsShape";

function numOrBlank(value: number | undefined) {
  return value === undefined ? "" : String(value);
}

export function PricingSettingsForm({ initialSettings, equipment }: {
  initialSettings: PricingSettings;
  equipment: EquipmentDefinition[];
}) {
  const [extraPrice, setExtraPrice] = useState(String(initialSettings.extra_equipment_price));
  const [equipmentPrices, setEquipmentPrices] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const item of equipment) map[item.id] = numOrBlank(initialSettings.equipment_price_overrides[item.id]);
    return map;
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
      const response = await fetch("/api/vendedor/pricing", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          extra_equipment_price: Number(extraPrice),
          equipment_price_overrides,
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
        <h2>Reglas estándar del remolque</h2>
        <p>Los precios base, ejes permitidos y alturas disponibles son iguales en el cotizador público y en el panel de vendedores.</p>
        <p>Los remolques cotizados por debajo de 3.00 m incluyen 2 aditamentos; desde 3.00 m incluyen 5. Una extensión de +40 cm toma el precio y la cantidad incluida del siguiente estándar.</p>
        <p>Las restricciones técnicas se aplican usando el largo real: si esa medida requiere obligatoriamente 2 o 3 ejes, el vendedor no puede reducirlos.</p>
      </div>

      <div className="pricing-settings-section">
        <h2>Tarifa de aditamentos adicionales</h2>
        <p>Se usa en cualquier aditamento sin precio propio, una vez agotada la cantidad incluida por el tamaño.</p>
        <div className="pricing-settings-row">
          <label>Precio del resto<input type="number" min={0} value={extraPrice} onChange={(event) => setExtraPrice(event.target.value)} /></label>
        </div>
      </div>

      {(["food", "cargo", "rzr"] as ModelId[]).map((model) => (
        <div className="pricing-settings-section" key={model}>
          <h2>{MODEL_META[model].shortLabel} · aditamentos</h2>
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
