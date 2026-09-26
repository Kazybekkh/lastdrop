"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatGbpSpeech } from "@/lib/format";
import { CATALOG, applyOrder, readProduct, type ShopOrder } from "@/lib/shop";
import { readPostedOrder } from "@/lib/shop-session";
import { AppNav } from "./app-nav";

export function StoreHome() {
  const [posted, setPosted] = useState<ShopOrder | null>(null);

  useEffect(() => {
    setPosted(readPostedOrder());
  }, []);

  const products = useMemo(() => applyOrder(CATALOG, posted), [posted]);

  return (
    <div className="store">
      <AppNav current="shop" />
      <header className="store-hero">
        <p className="office-kicker">Harbor & Co.</p>
        <h1>Retail, as the customer sees it.</h1>
        <p>One of these is selling. One has been waiting nine weeks for a buyer.</p>
      </header>
      <ul className="store-grid">
        {products.map((product) => {
          const read = readProduct(product);
          const variant = product.variants[0];
          return (
            <li key={product.id}>
              <Link href={`/shop/products/${product.handle}`} className="store-card">
                <span className={`swatch swatch-${product.handle}`} aria-hidden="true" />
                <p className="office-kicker">{product.productType}</p>
                <h2>{product.title}</h2>
                <p>{product.blurb}</p>
                <p className="store-price">
                  {variant ? formatGbpSpeech(variant.pricePence) : ""}
                  <span>{read.onHand > 0 ? `${read.onHand} in the warehouse` : "Wholesale hold"}</span>
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function StoreBar() {
  return <AppNav current="shop" />;
}
