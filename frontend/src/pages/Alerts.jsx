import { useState, useEffect } from "react";
import { apiFetch } from "../api.js";

function Alerts() {
  const [expiry, setExpiry] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch("/stock/expiry-alerts"),
      apiFetch("/stock/low-stock"),
    ])
      .then(([e, ls]) => {
        setExpiry(e);
        setLowStock(ls);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function expiryBadge(days) {
    if (days < 0) return { cls: "badge-red", label: "EXPIRED" };
    if (days <= 30) return { cls: "badge-red", label: "Expiring in 30d" };
    if (days <= 60) return { cls: "badge-orange", label: "Expiring in 60d" };
    return { cls: "badge-yellow", label: "Expiring in 90d" };
  }

  if (loading) return <div className="loading">Loading alerts…</div>;
  if (error) return <div className="error-box">⚠ {error}</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Alerts</h1>
          <p>
            From <code>vw_expiry_alert</code> and <code>vw_low_stock</code>
          </p>
        </div>
      </div>

      <div className="card">
        <div className="section-title">
          Expiry Alerts — <code>vw_expiry_alert</code>
          <span
            style={{
              float: "right",
              fontSize: 12,
              color: "#888",
              fontWeight: "normal",
            }}
          >
            {expiry.length} item(s)
          </span>
        </div>
        {expiry.length === 0 ? (
          <div className="alert alert-success">
            No expiry alerts. All stock is within safe dates.
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Batch No</th>
                  <th>Supplier</th>
                  <th>Expiry Date</th>
                  <th>Days Left</th>
                  <th>Current Stock</th>
                  <th>Alert Level</th>
                </tr>
              </thead>
              <tbody>
                {expiry.map((s, i) => {
                  const days = Math.ceil(
                    (new Date(s.expiry_date) - new Date()) / 86400000,
                  );
                  const badge = expiryBadge(days);
                  return (
                    <tr key={i}>
                      <td>{s.medicine_name}</td>
                      <td>
                        <span className="td-primary">{s.batch_no}</span>
                      </td>
                      <td>{s.supplier_name || s.supplier}</td>
                      <td style={{ color: days <= 30 ? "red" : "#333" }}>
                        {s.expiry_date}
                      </td>
                      <td
                        style={{
                          color: days <= 30 ? "red" : "#333",
                          fontWeight: "bold",
                        }}
                      >
                        {days < 0 ? "Expired" : `${days} days`}
                      </td>
                      <td>{s.current_qty ?? s.current_stock}</td>
                      <td>
                        <span className={`badge ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="section-title">
          Low Stock Alerts — <code>vw_low_stock</code>
          <span
            style={{
              float: "right",
              fontSize: 12,
              color: "#888",
              fontWeight: "normal",
            }}
          >
            {lowStock.length} item(s)
          </span>
        </div>
        {lowStock.length === 0 ? (
          <div className="alert alert-success">
            All medicines are above their reorder levels.
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Batch No</th>
                  <th>Supplier</th>
                  <th>Reorder Level</th>
                  <th>Current Stock</th>
                  <th>Shortage</th>
                  <th>Alert</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((s, i) => {
                  const qty = s.current_qty ?? s.current_stock ?? 0;
                  const shortage = Math.max(0, (s.reorder_level || 0) - qty);
                  return (
                    <tr key={i}>
                      <td>{s.medicine_name}</td>
                      <td>
                        <span className="td-primary">{s.batch_no}</span>
                      </td>
                      <td>{s.supplier_name || s.supplier}</td>
                      <td>{s.reorder_level}</td>
                      <td
                        style={{
                          color: qty <= 0 ? "red" : "orange",
                          fontWeight: "bold",
                        }}
                      >
                        {qty}
                      </td>
                      <td style={{ color: "red" }}>{shortage}</td>
                      <td>
                        <span
                          className={`badge ${qty <= 0 ? "badge-red" : "badge-orange"}`}
                        >
                          {qty <= 0 ? "Out of Stock" : "Low Stock"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Alerts;
