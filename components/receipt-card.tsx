import type { Receipt } from "@/lib/commerce";

export function ReceiptCard({
  receipt,
  recorded,
  onClose,
}: {
  receipt: Receipt;
  recorded: boolean;
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
        <button type="button" className="primary" onClick={onClose}>
          New pitch
        </button>
      </article>
    </div>
  );
}
