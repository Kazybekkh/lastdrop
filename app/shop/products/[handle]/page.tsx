import { ProductPage } from "@/components/product-page";
import { CATALOG } from "@/lib/shop";

export function generateStaticParams() {
  return CATALOG.map((product) => ({ handle: product.handle }));
}

export default async function Page({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return <ProductPage handle={handle} />;
}
