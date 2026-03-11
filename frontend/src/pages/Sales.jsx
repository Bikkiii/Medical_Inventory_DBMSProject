import { useState, useEffect } from "react";
import { apiFetch } from "../api.js";

function NewSaleModal({ medicines, users, onClose, onSubmit }) {
  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    served_by_user_id: "",
    payment_mode: "cash",
  });
  const [item, setItem] = useState({
    medicine_id: "",
    batch_item_id: "",
    qty: "",
    unit_price: "",
    discount_pct: "0",
  });

  const subtotal =
    item.qty && item.unit_price
      ? (item.qty * item.unit_price * (1 - item.discount_pct / 100)).toFixed(2)
      : "0.00";

  return (
    <div className="modal-backdrop">
      <div className="modal-box">
        <h3>Process New Sale</h3>
        <div className="modal-body">
          <div className="form-grid" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label>Customer Name</label>
              <input
                value={form.customer_name}
                onChange={(e) =>
                  setForm({ ...form, customer_name: e.target.value })
                }
                placeholder="Ram Sharma"
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="9800000001"
              />
            </div>
            <div className="form-group">
              <label>Served By</label>
              <select
                value={form.served_by_user_id}
                onChange={(e) =>
                  setForm({ ...form, served_by_user_id: e.target.value })
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
            <div className="form-group">
              <label>Payment Mode</label>
              <select
                value={form.payment_mode}
                onChange={(e) =>
                  setForm({ ...form, payment_mode: e.target.value })
                }
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
                <option value="insurance">Insurance</option>
              </select>
            </div>
          </div>

          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
            Medicine Item
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>Medicine</label>
              <select
                value={item.medicine_id}
                onChange={(e) =>
                  setItem({ ...item, medicine_id: e.target.value })
                }
              >
                <option value="">-- Select --</option>
                {medicines.map((m) => (
                  <option key={m.medicine_id} value={m.medicine_id}>
                    {m.medicine_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Batch Item ID</label>
              <input
                type="number"
                value={item.batch_item_id}
                onChange={(e) =>
                  setItem({ ...item, batch_item_id: e.target.value })
                }
                placeholder="e.g. 1"
              />
            </div>
            <div className="form-group">
              <label>Quantity</label>
              <input
                type="number"
                value={item.qty}
                onChange={(e) => setItem({ ...item, qty: e.target.value })}
                placeholder="e.g. 5"
              />
            </div>
            <div className="form-group">
              <label>Unit Price (Rs.)</label>
              <input
                value={item.unit_price}
                onChange={(e) =>
                  setItem({ ...item, unit_price: e.target.value })
                }
                placeholder="3.50"
              />
            </div>
            <div className="form-group">
              <label>Discount (%)</label>
              <input
                type="number"
                value={item.discount_pct}
                onChange={(e) =>
                  setItem({ ...item, discount_pct: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Subtotal (Rs.)</label>
              <input value={subtotal} readOnly />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-success"
            onClick={() => onSubmit({ ...form, items: [item] })}
          >
            Confirm Sale
          </button>
        </div>
      </div>
    </div>
  );
}

function Sales({ showToast }) {
  const [sales, setSales] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function loadAll() {
    setLoading(true);
    Promise.all([
      apiFetch("/sales"),
      apiFetch("/medicines"),
      apiFetch("/users"),
    ])
      .then(([s, m, u]) => {
        setSales(s);
        setMedicines(m);
        setUsers(u);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleSaleSubmit(data) {
    try {
      await apiFetch("/sales", { method: "POST", body: JSON.stringify(data) });
      setShowModal(false);
      showToast("Sale completed successfully.", "success");
      loadAll();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function statusBadge(status) {
    if (status === "completed") return "badge-green";
    if (status === "partially_returned") return "badge-yellow";
    if (status === "fully_returned") return "badge-red";
    return "badge-gray";
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Sales</h1>
          <p>Sale history and new transactions</p>
        </div>
        <button className="btn btn-success" onClick={() => setShowModal(true)}>
          + New Sale
        </button>
      </div>

      {error && <div className="error-box">⚠ {error}</div>}

      <div className="card">
        {loading ? (
          <div className="loading">Loading sales…</div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Sale ID</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Served By</th>
                  <th>Total (Rs.)</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Items</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s, i) => (
                  <tr key={i}>
                    <td>{s.sale_id}</td>
                    <td>{s.sale_date}</td>
                    <td>{s.customer_name}</td>
                    <td>{s.phone || s.customer_phone}</td>
                    <td>{s.served_by_name || s.served_by}</td>
                    <td>{parseFloat(s.total_amount || 0).toFixed(2)}</td>
                    <td>
                      <span className="badge badge-blue">{s.payment_mode}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${statusBadge(s.sale_status || s.status)}`}
                      >
                        {(s.sale_status || s.status || "").replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() =>
                          setSelectedSale(
                            selectedSale === s.sale_id ? null : s.sale_id,
                          )
                        }
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {sales.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      style={{
                        textAlign: "center",
                        color: "#888",
                        padding: 20,
                      }}
                    >
                      No sales recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedSale && (
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <div className="section-title" style={{ marginBottom: 0 }}>
              Sale #{selectedSale} — Items
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedSale(null)}
            >
              Close
            </button>
          </div>
          <p style={{ fontSize: 12, color: "#888" }}>
            Sale item details are stored in the <code>sale_item</code> table.
            You can query{" "}
            <code>SELECT * FROM sale_item WHERE sale_id = {selectedSale}</code>{" "}
            in MySQL Workbench.
          </p>
        </div>
      )}

      {showModal && (
        <NewSaleModal
          medicines={medicines}
          users={users}
          onClose={() => setShowModal(false)}
          onSubmit={handleSaleSubmit}
        />
      )}
    </div>
  );
}

export default Sales;
