import Link from "next/link";

const LINKS = [
  { href: "/", id: "catalog", label: "Catalog" },
  { href: "/shop", id: "shop", label: "Shop" },
  { href: "/floor", id: "match", label: "Match" },
] as const;

export function AppNav({ current }: { current: (typeof LINKS)[number]["id"] }) {
  return (
    <header className="app-nav">
      <Link href="/floor" className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <span>
          <strong>Harbor</strong>
          <small>Unmatched stock</small>
        </span>
      </Link>
      <nav>
        {LINKS.map((link) => (
          <Link key={link.id} href={link.href} aria-current={current === link.id ? "page" : undefined}>
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
