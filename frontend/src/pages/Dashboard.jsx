import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAlertTriangle,
  FiPackage,
  FiShoppingCart,
  FiClock,
} from "react-icons/fi";
import { apiFetch } from "../api";

const alertColor = {
  "EXPIRED":            "badge-red",
  "EXPIRING IN 30 DAYS":"badge-orange",
  "EXPIRING IN 60 DAYS":"badge-yellow",
  "EXPIRING IN 90 DAYS":"badge-yellow",
};
const stockColor = { "OUT OF STOCK": "badge-red", "LOW STOCK": "badge-orange" };

export default function Dashboard() {
  const [expiry, setExpiry]     = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [batches, setBatches]   = useState([]);
  const [sales, setSales]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.allSettled([
      apiFetch("/inventory/expiry-alerts"),
      apiFetch("/inventory/low-stock"),
      apiFetch("/batches"),
      apiFetch("/sales"),
    ]).then(([e, ls, b, s]) => {
      if (e.status  === "fulfilled") setExpiry(e.value);
      if (ls.status === "fulfilled") setLowStock(ls.value);
      if (b.status  === "fulfilled") setBatches(b.value);
      if (s.status  === "fulfilled") setSales(s.value);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="loading">Loading dashboard…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>{new Date().toLocaleDateString("en-NP", { dateStyle: "long" })}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary btn-sm" onClick={() => navigate("/batches/new")}>+ New Batch</button>
          <button className="btn btn-success btn-sm" onClick={() => navigate("/sales/new")}>+ New Sale</button>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate("/stock")}>View Stock</button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card teal">
          <div className="stat-icon teal"><FiPackage size={18} /></div>
          <div className="stat-value">{batches.length}</div>
          <div className="stat-label">Total Batches</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon blue"><FiShoppingCart size={18} /></div>
          <div className="stat-value">{sales.length}</div>
          <div className="stat-label">Total Sales</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-icon orange"><FiAlertTriangle size={18} /></div>
          <div className="stat-value">{lowStock.length}</div>
          <div className="stat-label">Low Stock Alerts</div>
        </div>
        <div className="stat-card red">
          <div className="stat-icon red"><FiClock size={18} /></div>
          <div className="stat-value">{expiry.length}</div>
          <div className="stat-label">Expiry Alerts (90d)</div>
        </div>
      </div>

      <div className="two-col-wide">
        {/* Left col */}
        <div>
          {/* Expiry Alerts */}
          <div className="card">
            <div className="section-title">
              Expiry Alerts
              {expiry.length > 0 && (
                <span className="badge badge-red">{expiry.length} items</span>
              )}
            </div>
            {expiry.length === 0 ? (
              <div className="alert alert-success">✓ No expiry alerts. All stock is within safe dates.</div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Medicine</th>
                      <th>Batch</th>
                      <th>Supplier</th>
                      <th>Expiry</th>
                      <th>Stock</th>
                      <th>Alert</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiry.slice(0, 8).map((item, i) => (
                      <tr key={i}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.medicine_name}</div>
                          <div className="td-muted">{item.brand_name}</div>
                        </td>
                        <td className="td-primary">{item.batch_no}</td>
                        <td className="td-muted">{item.supplier_name}</td>
                        <td>{new Date(item.expiry_date).toLocaleDateString()}</td>
                        <td><strong>{item.current_stock}</strong></td>
                        <td>
                          <span className={`badge ${alertColor[item.alert_level] || "badge-gray"}`}>
                            {item.alert_level}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Batches */}
          <div className="card">
            <div className="section-title">
              Recent Batches
              <button className="btn btn-secondary btn-xs" onClick={() => navigate("/batches")}>View All</button>
            </div>
            {batches.length === 0 ? (
              <div className="empty-state"><p>No batches yet.</p></div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Batch No</th><th>Supplier</th><th>Date</th><th>Invoice Amt</th></tr>
                  </thead>
                  <tbody>
                    {batches.slice(0, 5).map(b => (
                      <tr key={b.batch_id}>
                        <td className="td-primary">{b.batch_no}</td>
                        <td>{b.supplier_name}</td>
                        <td className="td-muted">{new Date(b.received_date).toLocaleDateString()}</td>
                        <td>Rs. {parseFloat(b.invoice_amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right col */}
        <div>
          {/* Low Stock */}
          <div className="card">
            <div className="section-title">
              Low Stock
              {lowStock.length > 0 && (
                <span className="badge badge-orange">{lowStock.length} medicines</span>
              )}
            </div>
            {lowStock.length === 0 ? (
              <div className="alert alert-success">✓ All stock levels are fine.</div>
            ) : (
              lowStock.slice(0, 6).map((item, i) => (
                <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{item.medicine_name}</div>
                    <div className="td-muted">{item.brand_name} · {item.category}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className={`badge ${stockColor[item.stock_alert] || "badge-gray"}`}>{item.stock_alert}</span>
                    <div className="td-muted" style={{ marginTop: 3 }}>Stock: {item.total_stock} / Reorder: {item.reorder_level}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Recent Sales */}
          <div className="card">
            <div className="section-title">
              Recent Sales
              <button className="btn btn-secondary btn-xs" onClick={() => navigate("/sales")}>View All</button>
            </div>
            {sales.length === 0 ? (
              <div className="empty-state"><p>No sales recorded yet.</p></div>
            ) : (
              sales.slice(0, 5).map(s => (
                <div key={s.sale_id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.customer_name}</div>
                    <div className="td-muted">{s.payment_mode} · {s.served_by_full_name}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, color: "var(--teal)" }}>Rs. {parseFloat(s.total_amount).toFixed(2)}</div>
                    <div className="td-muted">{new Date(s.sale_date).toLocaleDateString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
