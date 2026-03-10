import { useState } from "react";
import { stockLedger } from "../data/mockData.js";

const TX_BADGE = {
  purchase: "badge-teal",
  sale: "badge-blue",
  return_in: "badge-yellow",
  damage_write_off: "badge-red",
  return_out: "badge-orange",
  adjustment: "badge-gray",
};

const TYPES = [
  "all",
  "purchase",
  "sale",
  "return_in",
  "damage_write_off",
  "return_out",
];

function Ledger() {
  const [filter, setFilter] = useState("all");

  const rows =
    filter === "all"
      ? stockLedger
      : stockLedger.filter((r) => r.transaction_type === filter);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Stock Ledger</h1>
          <p>Full immutable audit trail of all stock movements</p>
        </div>
      </div>

      <div className="card">
        <div className="filter-pills">
          {TYPES.map((t) => (
            <button
              key={t}
              className={`filter-pill ${filter === t ? "active" : ""}`}
              onClick={() => setFilter(t)}
            >
              {t === "all" ? "All" : t.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Medicine</th>
                <th>Batch No</th>
                <th>Transaction Type</th>
                <th>Qty Change</th>
                <th>Balance After</th>
                <th>Done By</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.ledger_id}>
                  <td className="td-muted">{row.ledger_id}</td>
                  <td style={{ fontWeight: 500, color: "var(--text)" }}>
                    {row.medicine_name}
                  </td>
                  <td className="td-primary">{row.batch_no}</td>
                  <td>
                    <span
                      className={`badge ${TX_BADGE[row.transaction_type] || "badge-gray"}`}
                    >
                      {row.transaction_type.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 13,
                      fontWeight: 700,
                      color: row.quantity_change > 0 ? "#166534" : "#991b1b",
                    }}
                  >
                    {row.quantity_change > 0 ? "+" : ""}
                    {row.quantity_change}
                  </td>
                  <td
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {row.balance_after}
                  </td>
                  <td className="td-muted">{row.transacted_by}</td>
                  <td className="td-muted">{row.transacted_at}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <p>No entries match this filter.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-3)" }}>
          Showing {rows.length} of {stockLedger.length} entries
        </div>
      </div>
    </div>
  );
}

export default Ledger;
