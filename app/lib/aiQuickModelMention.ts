import { FOOD_QUICK_MODELS } from "./quoteCatalog";

export type ResolvedQuickModel = { model: "food"; quickModelId: string };

function normalizeMention(value: string): string {
  return value.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase()
    .replace(/[\s\p{Dash_Punctuation}]+/gu, " ").trim();
}

// Match complete catalog names/IDs, never a guessed name or a size substring.
export function resolveQuickModelMention(message: string): ResolvedQuickModel | null {
  const text = normalizeMention(message);
  const matches = FOOD_QUICK_MODELS.filter(entry => [entry.name, entry.id].some(value => {
    const alias = normalizeMention(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return alias.length > 0 && new RegExp(`(^|[^\\p{L}\\p{N}_])${alias}(?=$|[^\\p{L}\\p{N}_])`, "u").test(text);
  }));
  // Multiple mentions or overlapping catalog names are ambiguous; do not pick one.
  return matches.length === 1 ? { model: "food", quickModelId: matches[0].id } : null;
}
