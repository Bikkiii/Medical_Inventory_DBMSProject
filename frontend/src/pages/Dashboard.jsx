import { useState, useEffect } from "react";
import { apiFetch } from "../api.js";

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

function Dashboard() {
  const [ledger, setLedger] = useState([]);
  const [expiry, setExpiry] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [batches, setBatches] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch("/stock/ledger"),
      apiFetch("/stock/expiry-alerts"),
      apiFetch("/stock/low-stock"),
      apiFetch("/medicines"),
      apiFetch("/batches"),
      apiFetch("/sales"),
    ])
      .then(([l, e, ls, m, b, s]) => {
        setLedger(l);
        setExpiry(e);
        setLowStock(ls);
        setMedicines(m);
        setBatches(b);
        setSales(s);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading dashboard…</div>;
  if (error)
    return (
      <div className="error-box">
        ⚠ {error} — Is your backend running on port 3000?
      </div>
    );

  const recentLedger = [...ledger].slice(0, 6);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>{new Date().toLocaleDateString("en-NP", { dateStyle: "long" })}</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card teal">
          <div className="stat-icon teal">💊</div>
          <div className="stat-value">{medicines.length}</div>
          <div className="stat-label">Total Medicines</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon blue">📦</div>
          <div className="stat-value">{batches.length}</div>
          <div className="stat-label">Total Batches</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-icon orange">📉</div>
          <div className="stat-value">{lowStock.length}</div>
          <div className="stat-label">Low Stock Alerts</div>
        </div>
        <div className="stat-card red">
          <div className="stat-icon red">⏰</div>
          <div className="stat-value">{expiry.length}</div>
          <div className="stat-label">Expiry Alerts (90d)</div>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="section-title">Recent Stock Ledger Entries</div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Medicine</th>
                  <th>Type</th>
                  <th>Change</th>
                  <th>Balance</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentLedger.map((row, i) => (
                  <tr key={i}>
                    <td>{row.ledger_id}</td>
                    <td>{row.medicine_name}</td>
                    <td>
                      <span
                        className={`badge ${txBadge(row.transaction_type || row.txn_type)}`}
                      >
                        {(row.transaction_type || row.txn_type || "").replace(
                          /_/g,
                          " ",
                        )}
                      </span>
                    </td>
                    <td
                      style={{
                        color:
                          (row.quantity_change || row.qty_change) > 0
                            ? "green"
                            : "red",
                        fontWeight: "bold",
                      }}
                    >
                      {(row.quantity_change || row.qty_change) > 0 ? "+" : ""}
                      {row.quantity_change ?? row.qty_change}
                    </td>
                    <td>{row.balance_after}</td>
                    <td>{row.transacted_at || row.created_at}</td>
                  </tr>
                ))}
                {recentLedger.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        textAlign: "center",
                        color: "#888",
                        padding: 16,
                      }}
                    >
                      No entries yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="section-title">Expiry Alerts</div>
            {expiry.length === 0 ? (
              <div className="alert alert-success">
                No expiry alerts. All stock is within safe dates.
              </div>
            ) : (
              expiry.slice(0, 4).map((item, i) => {
                const days = Math.ceil(
                  (new Date(item.expiry_date) - new Date()) / 86400000,
                );
                return (
                  <div
                    key={i}
                    className="alert alert-warning"
                    style={{ marginBottom: 8 }}
                  >
                    <strong>{item.medicine_name}</strong> ({item.batch_no}) —
                    expires in <strong>{days} days</strong>
                  </div>
                );
              })
            )}
          </div>

          <div className="card">
            <div className="section-title">Low Stock Alerts</div>
            {lowStock.length === 0 ? (
              <div className="alert alert-success">
                All stock levels are fine.
              </div>
            ) : (
              lowStock.slice(0, 4).map((item, i) => (
                <div
                  key={i}
                  className="alert alert-danger"
                  style={{ marginBottom: 8 }}
                >
                  <strong>{item.medicine_name}</strong> — stock:{" "}
                  <strong>{item.current_qty ?? item.current_stock}</strong>,
                  reorder: {item.reorder_level}
                </div>
              ))
            )}
          </div>

          <div className="card">
            <div className="section-title">Recent Sales</div>
            {sales.length === 0 ? (
              <p style={{ fontSize: 13, color: "#888" }}>
                No sales recorded yet.
              </p>
            ) : (
              sales.slice(0, 4).map((s) => (
                <div
                  key={s.sale_id}
                  style={{
                    fontSize: 13,
                    padding: "6px 0",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <strong>{s.customer_name}</strong> — Rs.
                  {parseFloat(s.total_amount || 0).toFixed(2)} via{" "}
                  {s.payment_mode}
                  <span style={{ float: "right", color: "#888" }}>
                    {s.sale_date}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
