import { useState } from "react";
import { currentStock } from "../data/mockData.js";

function getExpiryStatus(expiryDate) {
  const days = Math.ceil((new Date(expiryDate) - new Date()) / 86400000);
  if (days < 0) return { label: "Expired", cls: "badge-red" };
  if (days <= 30) return { label: `${days}d left`, cls: "badge-red" };
  if (days <= 60) return { label: `${days}d left`, cls: "badge-orange" };
  if (days <= 90) return { label: `${days}d left`, cls: "badge-yellow" };
  return { label: "OK", cls: "badge-green" };
}

function getStockStatus(stock, reorder) {
  if (stock <= 0) return { label: "Out of Stock", cls: "badge-red" };
  if (stock <= reorder) return { label: "Low Stock", cls: "badge-orange" };
  return { label: "OK", cls: "badge-green" };
}

function DamageModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    batch_item_id: "",
    quantity_damaged: "",
    damage_cause: "storage",
    resolution: "write_off",
    processed_by: "Aayush Chhuka",
  });
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  return (
    <div className="modal-backdrop">
      <div className="modal-box">
        <div className="modal-header">
          <h3>Report Damage / Write-off</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="alert alert-warning" style={{ marginBottom: 16 }}>
            ⚠ This will reduce stock in the ledger with transaction type{" "}
            <code>damage_write_off</code>.
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>Batch Item ID</label>
              <input
                name="batch_item_id"
                value={form.batch_item_id}
                onChange={set}
                type="number"
                placeholder="e.g. 9"
              />
            </div>
            <div className="form-group">
              <label>Quantity Damaged</label>
              <input
                name="quantity_damaged"
                value={form.quantity_damaged}
                onChange={set}
                type="number"
                placeholder="e.g. 10"
              />
            </div>
            <div className="form-group">
              <label>Damage Cause</label>
              <select
                name="damage_cause"
                value={form.damage_cause}
                onChange={set}
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
              <select name="resolution" value={form.resolution} onChange={set}>
                <option value="write_off">Write Off</option>
                <option value="return_to_supplier">Return to Supplier</option>
              </select>
            </div>
            <div className="form-group">
              <label>Processed By</label>
              <select
                name="processed_by"
                value={form.processed_by}
                onChange={set}
              >
                <option>Aayush Chhuka</option>
                <option>Bikash Dhami</option>
                <option>Admin User</option>
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>
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
  const [search, setSearch] = useState("");
  const [showDamage, setShowDamage] = useState(false);

  const filtered = currentStock.filter(
    (r) =>
      r.medicine_name.toLowerCase().includes(search.toLowerCase()) ||
      r.batch_no.toLowerCase().includes(search.toLowerCase()) ||
      r.supplier.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Current Stock</h1>
          <p>
            Live view from <code>vw_current_stock</code>
          </p>
        </div>
        <div className="page-header-actions">
          <div className="search-wrapper">
            <input
              className="search-bar"
              placeholder="Search medicine, batch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            className="btn btn-warning"
            onClick={() => setShowDamage(true)}
          >
            ⚠ Report Damage
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Medicine Name</th>
                <th>Batch No</th>
                <th>Supplier</th>
                <th>Expiry Date</th>
                <th>Unit Price</th>
                <th>Stock</th>
                <th>Reorder</th>
                <th>Expiry Status</th>
                <th>Stock Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const exp = getExpiryStatus(row.expiry_date);
                const stk = getStockStatus(
                  row.current_stock,
                  row.reorder_level,
                );
                return (
                  <tr key={row.batch_item_id}>
                    <td className="td-muted">{row.batch_item_id}</td>
                    <td style={{ fontWeight: 500, color: "var(--text)" }}>
                      {row.medicine_name}
                    </td>
                    <td className="td-primary">{row.batch_no}</td>
                    <td className="td-muted">{row.supplier}</td>
                    <td className="td-muted">{row.expiry_date}</td>
                    <td
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 12,
                      }}
                    >
                      Rs. {row.unit_price.toFixed(2)}
                    </td>
                    <td
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--text)",
                      }}
                    >
                      {row.current_stock}
                    </td>
                    <td className="td-muted">{row.reorder_level}</td>
                    <td>
                      <span className={`badge ${exp.cls}`}>{exp.label}</span>
                    </td>
                    <td>
                      <span className={`badge ${stk.cls}`}>{stk.label}</span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="empty-state">
                    <p>No records match your search.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-3)" }}>
          Showing {filtered.length} of {currentStock.length} items
        </div>
      </div>

      {showDamage && (
        <DamageModal
          onClose={() => setShowDamage(false)}
          onSubmit={(form) => {
            console.log(
              "CALL sp_report_damage(",
              form.batch_item_id,
              form.quantity_damaged,
              form.damage_cause,
              form.resolution,
              ");",
            );
            setShowDamage(false);
            showToast("Damage reported. Stock ledger updated.", "success");
          }}
        />
      )}
    </div>
  );
}

export default Stock;
