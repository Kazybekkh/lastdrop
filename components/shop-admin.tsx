"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatGbpExact, formatGbpSpeech } from "@/lib/format";
import {
  CATALOG,
  WINDOW_WEEKS,
  applyOrder,
  deadStock,
  ordersWithWholesale,
  readProduct,
  stockLabel,
  type ShopOrder,
} from "@/lib/shop";
import { readPostedOrder } from "@/lib/shop-session";

export function ShopAdmin() {
  const [posted, setPosted] = useState<ShopOrder | null>(null);

  useEffect(() => {
    setPosted(readPostedOrder());
  }, []);

  const products = useMemo(() => applyOrder(CATALOG, posted), [posted]);
  const stuck = deadStock(products);
  const orders = ordersWithWholesale(posted);
  const hero = stuck[0] ?? products[0];
  const heroRead = hero ? readProduct(hero) : null;

  return (
    <div className="office">
      <header className="office-bar">
        <div>
          <p className="office-kicker">Harbor & Co. · Hackney</p>
          <strong>Catalog</strong>
        </div>
        <nav className="office-nav">
          <Link href="/shop">Storefront</Link>
          <Link href="/floor">The Drop</Link>
        </nav>
      </header>
      <p className="sim-banner">
        Simulated Shopify catalog. No store token is connected, so this is Harbor & Co.&apos;s fixture, not a live Admin API.
      </p>
      <main className="office-main">
        {hero && heroRead && (
          <section className={heroRead.dead ? "dead-hero" : "dead-hero clear"}>
            <p className="office-kicker">{heroRead.dead ? "Dead stock" : "Catalog"}</p>
            <h1>{hero.title}</h1>
            <p className="dead-lede">
              {heroRead.dead
                ? `${heroRead.sold} sold in ${WINDOW_WEEKS} weeks. ${heroRead.onHand} still on hand, about ${Math.round(heroRead.weeksOfCover ?? 0)} weeks of cover. ${formatGbpExact(heroRead.costTiedPence)} is tied up at cost. The oxford and the jean are moving. This lot is not.`
                : `${heroRead.onHand} left on hand. The wholesale docket has been written into the order book.`}
            </p>
            <dl className="metric-row">
              <div>
                <dt>On hand</dt>
                <dd>{heroRead.onHand}</dd>
              </div>
              <div>
                <dt>Sell-through</dt>
                <dd>{heroRead.onHand === 0 ? "Out" : `${Math.round(heroRead.sellThrough * 100)}%`}</dd>
              </div>
              <div>
                <dt>Retail</dt>
                <dd>{formatGbpSpeech(heroRead.retailPence)}</dd>
              </div>
              <div>
                <dt>SKU</dt>
                <dd>{heroRead.sku}</dd>
              </div>
            </dl>
            {heroRead.dead ? (
              <Link className="primary office-cta" href="/floor">
                Pitch this lot
              </Link>
            ) : (
              <p className="cleared">The run has left the rail. The wholesale order is in the book below.</p>
            )}
          </section>
        )}

        <section>
          <h2>Products</h2>
          <ul className="product-list">
            {products.map((product) => {
              const read = readProduct(product);
              return (
                <li key={product.id} className={read.dead ? "product-row is-dead" : "product-row"}>
                  <div>
                    <strong>{product.title}</strong>
                    <span>{product.productType} · {product.location}</span>
                  </div>
                  <p>{read.onHand} on hand</p>
                  <p>{read.sold} sold</p>
                  <p>{read.weeksOfCover == null ? "No rate" : `${Math.round(read.weeksOfCover)} wks cover`}</p>
                  <em>{stockLabel(read)}</em>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h2>Orders</h2>
          <ul className="order-list">
            {orders.map((order) => (
              <li key={order.name} className={order.channel === "The Last Drop" ? "order-row drop" : "order-row"}>
                <strong>{order.name}</strong>
                <span>{order.customer}</span>
                <span>{order.channel}</span>
                <span>{formatGbpExact(order.totalPence)}</span>
                <em>{order.financial}</em>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
