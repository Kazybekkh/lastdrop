import Link from "next/link";
import type { Receipt } from "@/lib/commerce";

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
        <p className="rubber approved">Approved</p>
        <h2 id="docket-title">Docket cut</h2>
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
