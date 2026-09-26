"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatGbpSpeech } from "@/lib/format";
import { CATALOG, applyOrder, readProduct, type ShopOrder } from "@/lib/shop";
import { readPostedOrder } from "@/lib/shop-session";

export function StoreHome() {
  const [posted, setPosted] = useState<ShopOrder | null>(null);

  useEffect(() => {
    setPosted(readPostedOrder());
  }, []);

  const products = useMemo(() => applyOrder(CATALOG, posted), [posted]);

  return (
    <div className="store">
      <StoreBar />
      <header className="store-hero">
        <p className="office-kicker">Harbor & Co. · est. Hackney</p>
        <h1>Cloth for people who stay.</h1>
        <p>Four styles. One of them has been sitting in the warehouse since July.</p>
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
  return (
    <div className="store-bar">
      <Link href="/shop" className="store-mark">
        Harbor & Co.
      </Link>
      <nav>
        <Link href="/shop">Shop</Link>
        <Link href="/">Admin</Link>
        <Link href="/floor">The Drop</Link>
      </nav>
    </div>
  );
}
