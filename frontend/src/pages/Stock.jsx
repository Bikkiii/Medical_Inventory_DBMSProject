import { useState, useEffect } from "react";
import { apiFetch } from "../api.js";

function getExpiryStatus(expiryDate) {
  const days = Math.ceil((new Date(expiryDate) - new Date()) / 86400000);
  if (days < 0) return { label: "Expired", cls: "badge-red" };
  if (days <= 30) return { label: "Expiring (30d)", cls: "badge-red" };
  if (days <= 60) return { label: "Expiring (60d)", cls: "badge-orange" };
  if (days <= 90) return { label: "Expiring (90d)", cls: "badge-yellow" };
  return { label: "OK", cls: "badge-green" };
}

function getStockStatus(stock, reorder) {
  if (stock <= 0) return { label: "Out of Stock", cls: "badge-red" };
  if (stock <= reorder) return { label: "Low Stock", cls: "badge-orange" };
  return { label: "OK", cls: "badge-green" };
}

function DamageModal({ users, onClose, onSubmit }) {
  const [form, setForm] = useState({
    batch_item_id: "",
    qty_damaged: "",
    damage_cause: "storage",
    resolution: "write_off",
    processed_by_user_id: "",
  });
  return (
    <div className="modal-backdrop">
      <div className="modal-box">
        <h3>Report Damage / Write-off</h3>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Batch Item ID</label>
              <input
                type="number"
                value={form.batch_item_id}
                onChange={(e) =>
                  setForm({ ...form, batch_item_id: e.target.value })
                }
                placeholder="e.g. 9"
              />
            </div>
            <div className="form-group">
              <label>Quantity Damaged</label>
              <input
                type="number"
                value={form.qty_damaged}
                onChange={(e) =>
                  setForm({ ...form, qty_damaged: e.target.value })
                }
                placeholder="e.g. 10"
              />
            </div>
            <div className="form-group">
              <label>Damage Cause</label>
              <select
                value={form.damage_cause}
                onChange={(e) =>
                  setForm({ ...form, damage_cause: e.target.value })
                }
              >
                <option value="transit">Transit</option>
                <option value="storage">Storage</option>
                <option value="expiry">Expiry</option>
                <option value="handling">Handling</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Resolution</label>
              <select
                value={form.resolution}
                onChange={(e) =>
                  setForm({ ...form, resolution: e.target.value })
                }
              >
                <option value="write_off">Write Off</option>
                <option value="return_to_supplier">Return to Supplier</option>
              </select>
            </div>
            <div className="form-group">
              <label>Processed By</label>
              <select
                value={form.processed_by_user_id}
                onChange={(e) =>
                  setForm({ ...form, processed_by_user_id: e.target.value })
                }
              >
                <option value="">-- Select --</option>
                {users.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={() => onSubmit(form)}>
            Report Damage
          </button>
        </div>
      </div>
    </div>
  );
}

function Stock({ showToast }) {
  const [stock, setStock] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [showDamage, setShowDamage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function loadStock() {
    setLoading(true);
    Promise.all([apiFetch("/stock"), apiFetch("/users")])
      .then(([s, u]) => {
        setStock(s);
        setUsers(u);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadStock();
  }, []);

  async function handleDamageSubmit(form) {
    try {
      await apiFetch("/returns/damage", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setShowDamage(false);
      showToast("Damage reported. Stock updated.", "success");
      loadStock();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  const filtered = stock.filter(
    (row) =>
      (row.medicine_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (row.batch_no || "").toLowerCase().includes(search.toLowerCase()) ||
      (row.supplier_name || "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Current Stock</h1>
          <p>
            Live from <code>vw_current_stock</code>
          </p>
        </div>
        <div className="page-header-actions">
          <div className="search-wrapper">
            <input
              className="search-bar"
              placeholder="Search medicine or batch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            className="btn btn-warning"
            onClick={() => setShowDamage(true)}
          >
            Report Damage
          </button>
        </div>
      </div>

      {error && <div className="error-box">⚠ {error}</div>}

      <div className="card">
        {loading ? (
          <div className="loading">Loading stock…</div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Medicine Name</th>
                  <th>Batch No</th>
                  <th>Supplier</th>
                  <th>Expiry Date</th>
                  <th>Unit Price (Rs.)</th>
                  <th>Current Stock</th>
                  <th>Reorder Level</th>
                  <th>Expiry Status</th>
                  <th>Stock Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => {
                  const qty = row.current_qty ?? row.current_stock ?? 0;
                  const reorder = row.reorder_level ?? 0;
                  const expSt = getExpiryStatus(row.expiry_date);
                  const stkSt = getStockStatus(qty, reorder);
                  return (
                    <tr key={i}>
                      <td>{row.batch_item_id}</td>
                      <td>{row.medicine_name}</td>
                      <td>
                        <span className="td-primary">{row.batch_no}</span>
                      </td>
                      <td>{row.supplier_name || row.supplier}</td>
                      <td>{row.expiry_date}</td>
                      <td>
                        {parseFloat(
                          row.unit_cost || row.unit_price || 0,
                        ).toFixed(2)}
                      </td>
                      <td>
                        <strong>{qty}</strong>
                      </td>
                      <td>{reorder}</td>
                      <td>
                        <span className={`badge ${expSt.cls}`}>
                          {expSt.label}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${stkSt.cls}`}>
                          {stkSt.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      style={{
                        textAlign: "center",
                        color: "#888",
                        padding: 20,
                      }}
                    >
                      No records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showDamage && (
        <DamageModal
          users={users}
          onClose={() => setShowDamage(false)}
          onSubmit={handleDamageSubmit}
        />
      )}
    </div>
  );
}

export default Stock;
