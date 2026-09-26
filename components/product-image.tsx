import Image from "next/image";

const IMAGES: Record<string, { src: string; alt: string }> = {
  "trucker-jacket": {
    src: "/products/trucker-jacket.webp",
    alt: "Indigo denim trucker jacket with brass buttons and contrast stitching",
  },
  "loom-jean": {
    src: "/products/loom-jean.webp",
    alt: "Dark indigo straight-leg jeans with five pockets and ochre stitching",
  },
  "oxford-shirt": {
    src: "/products/oxford-shirt.webp",
    alt: "White cotton Oxford shirt with a button-down collar and chest pocket",
  },
  "canvas-tote": {
    src: "/products/canvas-tote.webp",
    alt: "Natural canvas tote with long handles and an exterior pocket",
  },
};

export function ProductImage({ handle, className = "", sizes, priority = false }: {
  handle: string;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  const image = IMAGES[handle];
  if (!image) return null;
  return (
    <span className={`product-image ${className}`}>
      <Image src={image.src} alt={image.alt} fill sizes={sizes} priority={priority} />
    </span>
  );
}
