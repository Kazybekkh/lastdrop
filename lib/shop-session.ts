import type { ShopOrder } from "./shop";

const KEY = "lastdrop.wholesale";

export function readPostedOrder(): ShopOrder | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ShopOrder;
    if (!parsed || parsed.channel !== "The Last Drop" || !Array.isArray(parsed.lines)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePostedOrder(order: ShopOrder) {
  window.sessionStorage.setItem(KEY, JSON.stringify(order));
}
