import { formatGbpExact, formatGbpSpeech } from "@/lib/format";
import { LOT } from "@/lib/lot";
import { ProductImage } from "./product-image";

export function HangTag({
  floorPence,
  locked,
  onFloor,
}: {
  floorPence: number;
  locked: boolean;
  onFloor: (pence: number) => void;
}) {
  const pounds = Math.round(floorPence / 100);

  function setPounds(value: number) {
    if (!Number.isFinite(value)) return;
    const next = Math.min(38, Math.max(10, Math.round(value)));
    onFloor(next * 100);
  }

  return (
    <article className="tag">
      <div className="lot-overview">
        <ProductImage handle="trucker-jacket" className="lot-visual" sizes="(max-width: 640px) calc(100vw - 54px), 268px" priority />
        <div>
          <p className="eyebrow">Unmatched · week {LOT.weeksOnRail}</p>
          <h2>{LOT.title}</h2>
          <p className="why">{LOT.why}</p>
          <p className="spec-line">{LOT.cloth} · {LOT.origin}</p>
        </div>
      </div>
      <dl className="facts">
        <div>
          <dt>Units</dt>
          <dd>{LOT.quantity}</dd>
        </div>
        <div>
          <dt>Wash</dt>
          <dd>{LOT.wash}</dd>
        </div>
        <div>
          <dt>Cloth</dt>
          <dd>{LOT.cloth}</dd>
        </div>
        <div>
          <dt>Origin</dt>
          <dd>{LOT.origin}</dd>
        </div>
        <div>
          <dt>Hardware</dt>
          <dd>{LOT.hardware}</dd>
        </div>
      </dl>
      <div className="money-row">
        <p>
          <span>Cost</span>
          <strong>{formatGbpExact(LOT.costPence)}</strong>
        </p>
        <p>
          <span>Asking</span>
          <strong>{formatGbpSpeech(LOT.askingPricePence)}</strong>
        </p>
        <p>
          <span>RRP</span>
          <strong>{formatGbpSpeech(LOT.rrpPence)}</strong>
        </p>
      </div>
      <label className="floor-control">
        <span>Your floor</span>
        <strong>{formatGbpSpeech(floorPence)}</strong>
        <input
          type="range"
          min={10}
          max={38}
          step={1}
          value={pounds}
          disabled={locked}
          aria-label="Floor price in pounds"
          onChange={(event) => setPounds(Number(event.target.value))}
        />
      </label>
      <label className="floor-number">
        <span>Pounds</span>
        <input
          type="number"
          min={10}
          max={38}
          step={1}
          value={pounds}
          disabled={locked}
          aria-label="Floor price in pounds, exact"
          onChange={(event) => setPounds(Number(event.target.value))}
        />
      </label>
      <p className="floor-note">
        {locked
          ? "Floor is locked. Anything under it is refused and cannot become the match."
          : "Leave this at £22. A £16 bid is refused and can never win."}
      </p>
    </article>
  );
}
