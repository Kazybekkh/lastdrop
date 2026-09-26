import Link from "next/link";
import type { Receipt } from "@/lib/commerce";
import { formatGbpExact, formatLondon } from "@/lib/format";

export function ReceiptCard({
  receipt,
  recorded,
  shopOrderName,
  onClose,
}: {
  receipt: Receipt;
  recorded: boolean;
  shopOrderName: string | null;
  onClose: () => void;
}) {
  return (
    <div className="shade" role="presentation">
      <article className="docket" role="dialog" aria-modal="true" aria-labelledby="docket-title">
        <p className="status-pill ok">Match confirmed</p>
        <h2 id="docket-title">{receipt.winnerName} takes the lot</h2>
        <dl className="confirm-grid">
          <div>
            <dt>Lot</dt>
            <dd>{receipt.lotTitle}</dd>
          </div>
          <div>
            <dt>Winner</dt>
            <dd>{receipt.winnerName}</dd>
          </div>
          <div>
            <dt>Unit</dt>
            <dd>{formatGbpExact(receipt.unitPricePence)}</dd>
          </div>
          <div>
            <dt>Qty</dt>
            <dd>{receipt.quantity}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{formatGbpExact(receipt.totalPence)}</dd>
          </div>
          <div>
            <dt>When</dt>
            <dd>{formatLondon(receipt.timestamp)}</dd>
          </div>
        </dl>
        <pre>{receipt.text}</pre>
        <p className="docket-note">
          {recorded
            ? "Recorded round. The voices were scripted. This docket was cut by the floor rules, not by a model."
            : "The desks spoke through Grok. This docket was cut by the floor rules, not by the model."}
        </p>
        {shopOrderName && (
          <p className="docket-note">
            Posted to the Harbor & Co. catalog as order {shopOrderName}.{" "}
            <Link href="/">Open the order book</Link>
          </p>
        )}
        <button type="button" className="primary" onClick={onClose}>
          New pitch
        </button>
      </article>
    </div>
  );
}
