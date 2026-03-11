import { useState, useEffect } from "react";
import { apiFetch } from "../api.js";

const TYPES = [
  "all",
  "purchase",
  "sale",
  "return_in",
  "damage_write_off",
  "return_out",
];

function txBadge(type) {
  const map = {
    purchase: "badge-green",
    sale: "badge-blue",
    return_in: "badge-yellow",
    damage_write_off: "badge-red",
    return_out: "badge-orange",
  };
  return map[type] || "badge-gray";
}

function Ledger() {
  const [ledger, setLedger] = useState([]);
  const [filterType, setFilterType] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    apiFetch("/stock/ledger")
      .then((data) => setLedger(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    filterType === "all"
      ? ledger
      : ledger.filter((r) => (r.transaction_type || r.txn_type) === filterType);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Stock Ledger (Audit Trail)</h1>
          <p>
            All stock movements from the <code>stock_ledger</code> table
          </p>
        </div>
      </div>

      {error && <div className="error-box">⚠ {error}</div>}

      <div className="card">
        <div className="filter-pills">
          <span style={{ fontSize: 13, color: "#555", lineHeight: "28px" }}>
            Filter:
          </span>
          {TYPES.map((t) => (
            <button
              key={t}
              className={`filter-pill ${filterType === t ? "active" : ""}`}
              onClick={() => setFilterType(t)}
            >
              {t === "all" ? "All" : t.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading">Loading ledger…</div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Ledger ID</th>
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
                {filtered.map((row, i) => {
                  const txType = row.transaction_type || row.txn_type || "";
                  const change = row.quantity_change ?? row.qty_change ?? 0;
                  return (
                    <tr key={i}>
                      <td>{row.ledger_id}</td>
                      <td>{row.medicine_name}</td>
                      <td>
                        <span className="td-primary">{row.batch_no}</span>
                      </td>
                      <td>
                        <span className={`badge ${txBadge(txType)}`}>
                          {txType.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td
                        style={{
                          color: change > 0 ? "green" : "red",
                          fontWeight: "bold",
                        }}
                      >
                        {change > 0 ? "+" : ""}
                        {change}
                      </td>
                      <td>
                        <strong>{row.balance_after}</strong>
                      </td>
                      <td>{row.transacted_by || row.user_name}</td>
                      <td>{row.transacted_at || row.created_at}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        textAlign: "center",
                        color: "#888",
                        padding: 20,
                      }}
                    >
                      No entries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ fontSize: 12, color: "#888", marginTop: 10 }}>
          Showing {filtered.length} of {ledger.length} entries.
        </div>
      </div>
    </div>
  );
}

export default Ledger;
