"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatGbpSpeech } from "@/lib/format";
import { CATALOG, applyOrder, findByHandle, readProduct, type ShopOrder } from "@/lib/shop";
import { readPostedOrder } from "@/lib/shop-session";
import { StoreBar } from "./store-home";
import { ProductImage } from "./product-image";

export function ProductPage({ handle }: { handle: string }) {
  const [posted, setPosted] = useState<ShopOrder | null>(null);
  const [bag, setBag] = useState(false);

  useEffect(() => {
    setPosted(readPostedOrder());
  }, []);

  const products = useMemo(() => applyOrder(CATALOG, posted), [posted]);
  const product = findByHandle(products, handle);

  if (!product) {
    return (
      <div className="store">
        <StoreBar />
        <main className="pdp">
          <h1>That style is not in the catalog.</h1>
          <Link href="/shop">Back to the shop</Link>
        </main>
      </div>
    );
  }

  const read = readProduct(product);
  const variant = product.variants[0];

  return (
    <div className="store">
      <StoreBar />
      <main className="pdp">
        <ProductImage handle={product.handle} className="pdp-visual" sizes="(max-width: 640px) calc(100vw - 32px), 600px" priority />
        <div>
          <p className="office-kicker">{product.vendor} · {product.productType}</p>
          <h1>{product.title}</h1>
          <p className="pdp-price">{variant ? formatGbpSpeech(variant.pricePence) : ""}</p>
          <p>{product.blurb}</p>
          <p>{product.detail}</p>
          <p className="pdp-stock">
            {read.onHand > 0
              ? `${read.onHand} on hand at ${product.location}. ${read.sold} sold in the last nine weeks.`
              : "The full run left on a wholesale docket. Nothing left at retail."}
          </p>
          <button type="button" className="primary" disabled={read.onHand === 0 || bag} onClick={() => setBag(true)}>
            {read.onHand === 0 ? "Gone wholesale" : bag ? "In the bag · 1" : "Add one to the bag"}
          </button>
          {bag && (
            <p className="bag-note">
              Retail bag: 1 × {product.title} at {variant ? formatGbpSpeech(variant.pricePence) : ""}. {Math.max(0, read.onHand - 1)} remain at {product.location}.
            </p>
          )}
          {product.handle === "trucker-jacket" && read.dead && (
            <p className="bag-note">
              <Link href="/">Open this in the catalog</Link> and pitch the lot.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
