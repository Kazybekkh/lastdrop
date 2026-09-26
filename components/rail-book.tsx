import { CAST } from "@/lib/cast";
import type { Book } from "@/lib/commerce";
import { formatGbpExact } from "@/lib/format";
import { LOT } from "@/lib/lot";

export function RailBook({ book, floorPence }: { book: Book; floorPence: number }) {
  return (
    <aside className="book">
      <header>
        <h2>Offers</h2>
        <p>Best total above the floor wins. A higher unit price on a short cut can lose.</p>
      </header>
      <div className="above">
        {book.standing.length === 0 && <p className="quiet">No bid has cleared the floor.</p>}
        {book.standing.map((offer) => {
          const best = book.winner?.agentId === offer.agentId;
          const margin = offer.unitPricePence - LOT.costPence;
          return (
            <article key={offer.agentId} className={best ? "offer best" : "offer"}>
              <p className="who">
                <strong>{CAST[offer.agentId].name}</strong>
                <span>{CAST[offer.agentId].role}</span>
              </p>
              <p className="offer-price">
                {formatGbpExact(offer.unitPricePence)} <span>× {offer.quantity}</span>
              </p>
              <p className="offer-total">{formatGbpExact(offer.totalPence)}</p>
              {best && <p className="best-flag">Best match · {formatGbpExact(margin)} over cost</p>}
            </article>
          );
        })}
      </div>
      <div className="rail" aria-hidden="true">
        <i />
        <span>Floor {formatGbpExact(floorPence)}</span>
        <i />
      </div>
      <div className="below">
        <h3>Refused</h3>
        {book.blocked.length === 0 && <p className="quiet">Nothing under the floor yet.</p>}
        {book.blocked.map((row, index) => (
          <p key={`${row.at}-${index}`} className="refused">
            <strong>{CAST[row.agentId].name}</strong>
            <span>
              {row.unitPricePence != null ? formatGbpExact(row.unitPricePence) : "—"}
              {row.quantity != null ? ` × ${row.quantity}` : " counter"}
            </span>
            <em>Blocked</em>
          </p>
        ))}
      </div>
      {book.walked.length > 0 && (
        <p className="walked-note">
          Walked: {book.walked.map((id) => CAST[id].name).join(", ")}. Their bids are off the book.
        </p>
      )}
    </aside>
  );
}
