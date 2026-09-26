import { formatGbpExact, formatGbpSpeech } from "@/lib/format";
import { LOT } from "@/lib/lot";

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
      <div className="tag-string" aria-hidden="true" />
      <div className="tag-hole" aria-hidden="true" />
      <p className="eyebrow">Week {String(LOT.weeksOnRail).padStart(2, "0")} on the rail</p>
      <h2>{LOT.title}</h2>
      <p className="why">{LOT.why}</p>
      <p className="spec-line">{LOT.cloth} · {LOT.origin}</p>
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
          ? "Floor is locked for this round. Bids under it are stamped and cannot win."
          : "Leave this at £22. Len will offer £16, and the rail will refuse him."}
      </p>
    </article>
  );
}
