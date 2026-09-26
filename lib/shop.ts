import type { Receipt } from "./commerce";

export const WINDOW_WEEKS = 9;
export const DEAD_MIN_ON_HAND = 80;
export const DEAD_MAX_SELL_THROUGH = 0.15;
export const DEAD_MIN_WEEKS_OF_COVER = 26;

export interface CatalogVariant {
  id: string;
  sku: string;
  title: string;
  pricePence: number;
  costPence: number;
  onHand: number;
  soldInWindow: number;
}

export interface CatalogProduct {
  id: string;
  handle: string;
  title: string;
  productType: string;
  vendor: string;
  blurb: string;
  detail: string;
  tags: string[];
  location: string;
  variants: CatalogVariant[];
}

export interface StockRead {
  sku: string;
  onHand: number;
  sold: number;
  weeklyRate: number;
  weeksOfCover: number | null;
  sellThrough: number;
  costTiedPence: number;
  retailPence: number;
  dead: boolean;
}

export interface ShopOrderLine {
  sku: string;
  title: string;
  quantity: number;
  unitPricePence: number;
}

export interface ShopOrder {
  name: string;
  createdAt: string;
  channel: "Online Store" | "The Last Drop";
  customer: string;
  financial: "paid";
  fulfillment: "unfulfilled" | "fulfilled";
  docketId?: string;
  lines: ShopOrderLine[];
  totalPence: number;
}

export const TRUCKER_SKU = "HARB-TRK-13OZ";

export const CATALOG: CatalogProduct[] = [
  {
    id: "gid://shopify/Product/1001",
    handle: "trucker-jacket",
    title: "Trucker jacket",
    productType: "Outerwear",
    vendor: "Harbor & Co.",
    blurb: "13.5 oz Japanese selvedge, cut and sewn in Porto. Brass still in the bag.",
    detail: "Mid-indigo, even, no whisker. Unworn, tickets on. The full size run, XS–XXL.",
    tags: ["denim", "selvedge", "porto"],
    location: "Warehouse · Port of London",
    variants: [
      {
        id: "gid://shopify/ProductVariant/1001",
        sku: TRUCKER_SKU,
        title: "Full size run",
        pricePence: 11000,
        costPence: 1940,
        onHand: 300,
        soldInWindow: 12,
      },
    ],
  },
  {
    id: "gid://shopify/Product/1002",
    handle: "loom-jean",
    title: "Loom jean",
    productType: "Denim",
    vendor: "Harbor & Co.",
    blurb: "14 oz straight jean. The one people actually come back for.",
    detail: "Rinsed indigo. Sits at the waist. Restocked twice this season.",
    tags: ["denim", "core"],
    location: "Warehouse · Port of London",
    variants: [
      {
        id: "gid://shopify/ProductVariant/1002",
        sku: "HARB-JEAN-14",
        title: "Default",
        pricePence: 14500,
        costPence: 3200,
        onHand: 48,
        soldInWindow: 36,
      },
    ],
  },
  {
    id: "gid://shopify/Product/1003",
    handle: "oxford-shirt",
    title: "Oxford shirt",
    productType: "Shirting",
    vendor: "Harbor & Co.",
    blurb: "White oxford. The shop's working shirt.",
    detail: "Mother of pearl. Cut for a jacket underneath.",
    tags: ["shirting", "core"],
    location: "Warehouse · Port of London",
    variants: [
      {
        id: "gid://shopify/ProductVariant/1003",
        sku: "HARB-OXF-WHT",
        title: "White",
        pricePence: 8500,
        costPence: 1800,
        onHand: 22,
        soldInWindow: 80,
      },
    ],
  },
  {
    id: "gid://shopify/Product/1004",
    handle: "canvas-tote",
    title: "Canvas tote",
    productType: "Accessories",
    vendor: "Harbor & Co.",
    blurb: "Heavy canvas, one pocket, no slogan.",
    detail: "Natural, unlined. A steady seller beside the till.",
    tags: ["accessories"],
    location: "Shop floor · Hackney",
    variants: [
      {
        id: "gid://shopify/ProductVariant/1004",
        sku: "HARB-TOTE-NAT",
        title: "Natural",
        pricePence: 2800,
        costPence: 600,
        onHand: 64,
        soldInWindow: 41,
      },
    ],
  },
];

export const RETAIL_ORDERS: ShopOrder[] = [
  {
    name: "#1041",
    createdAt: "2026-09-24T11:10:00.000Z",
    channel: "Online Store",
    customer: "Priya Shah",
    financial: "paid",
    fulfillment: "fulfilled",
    lines: [{ sku: "HARB-OXF-WHT", title: "Oxford shirt", quantity: 1, unitPricePence: 8500 }],
    totalPence: 8500,
  },
  {
    name: "#1040",
    createdAt: "2026-09-22T16:40:00.000Z",
    channel: "Online Store",
    customer: "Jonah Adeyemi",
    financial: "paid",
    fulfillment: "fulfilled",
    lines: [{ sku: "HARB-JEAN-14", title: "Loom jean", quantity: 1, unitPricePence: 14500 }],
    totalPence: 14500,
  },
  {
    name: "#1039",
    createdAt: "2026-09-20T09:05:00.000Z",
    channel: "Online Store",
    customer: "Ellen Moss",
    financial: "paid",
    fulfillment: "fulfilled",
    lines: [{ sku: "HARB-TOTE-NAT", title: "Canvas tote", quantity: 1, unitPricePence: 2800 }],
    totalPence: 2800,
  },
  {
    name: "#986",
    createdAt: "2026-08-02T13:20:00.000Z",
    channel: "Online Store",
    customer: "Chris Pallister",
    financial: "paid",
    fulfillment: "fulfilled",
    lines: [{ sku: TRUCKER_SKU, title: "Trucker jacket", quantity: 1, unitPricePence: 11000 }],
    totalPence: 11000,
  },
];

export function readVariant(variant: CatalogVariant): StockRead {
  const onHand = variant.onHand;
  const sold = variant.soldInWindow;
  const weeklyRate = sold / WINDOW_WEEKS;
  const weeksOfCover = weeklyRate > 0 ? onHand / weeklyRate : null;
  const denom = sold + onHand;
  const sellThrough = denom === 0 ? 0 : sold / denom;
  const dead =
    onHand >= DEAD_MIN_ON_HAND &&
    sellThrough < DEAD_MAX_SELL_THROUGH &&
    (weeksOfCover == null || weeksOfCover > DEAD_MIN_WEEKS_OF_COVER);
  return {
    sku: variant.sku,
    onHand,
    sold,
    weeklyRate,
    weeksOfCover,
    sellThrough,
    costTiedPence: onHand * variant.costPence,
    retailPence: variant.pricePence,
    dead,
  };
}

export function readProduct(product: CatalogProduct): StockRead {
  const variant = product.variants[0];
  if (!variant) {
    return {
      sku: "",
      onHand: 0,
      sold: 0,
      weeklyRate: 0,
      weeksOfCover: null,
      sellThrough: 0,
      costTiedPence: 0,
      retailPence: 0,
      dead: false,
    };
  }
  return readVariant(variant);
}

export function deadStock(products: CatalogProduct[]): CatalogProduct[] {
  return products.filter((product) => readProduct(product).dead);
}

export function stockLabel(read: StockRead): "Dead stock" | "Moving" | "Cleared" {
  if (read.onHand === 0) return "Cleared";
  return read.dead ? "Dead stock" : "Moving";
}

export function findByHandle(products: CatalogProduct[], handle: string): CatalogProduct | undefined {
  return products.find((product) => product.handle === handle);
}

export function findBySku(products: CatalogProduct[], sku: string): { product: CatalogProduct; variant: CatalogVariant } | undefined {
  for (const product of products) {
    const variant = product.variants.find((item) => item.sku === sku);
    if (variant) return { product, variant };
  }
  return undefined;
}

export function nextOrderName(orders: ShopOrder[]): string {
  const nums = orders.map((order) => Number(order.name.replace(/\D/g, ""))).filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 1000) + 1;
  return `#${next}`;
}

export function wholesaleFromReceipt(receipt: Receipt, orders: ShopOrder[] = RETAIL_ORDERS): ShopOrder {
  return {
    name: nextOrderName(orders),
    createdAt: receipt.timestamp,
    channel: "The Last Drop",
    customer: `${receipt.winnerName} · ${receipt.winnerRole}`,
    financial: "paid",
    fulfillment: "unfulfilled",
    docketId: receipt.id,
    lines: [
      {
        sku: TRUCKER_SKU,
        title: receipt.lotTitle,
        quantity: receipt.quantity,
        unitPricePence: receipt.unitPricePence,
      },
    ],
    totalPence: receipt.totalPence,
  };
}

export function applyOrder(products: CatalogProduct[], order: ShopOrder | null): CatalogProduct[] {
  if (!order) return products;
  return products.map((product) => ({
    ...product,
    variants: product.variants.map((variant) => {
      const taken = order.lines
        .filter((line) => line.sku === variant.sku)
        .reduce((sum, line) => sum + line.quantity, 0);
      if (taken <= 0) return variant;
      return { ...variant, onHand: Math.max(0, variant.onHand - taken) };
    }),
  }));
}

export function ordersWithWholesale(posted: ShopOrder | null): ShopOrder[] {
  if (!posted) return RETAIL_ORDERS;
  return [posted, ...RETAIL_ORDERS];
}
