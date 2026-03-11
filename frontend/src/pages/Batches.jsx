import { useState, useEffect } from "react";
import { apiFetch } from "../api.js";

function AddBatchModal({ medicines, suppliers, users, onClose, onSubmit }) {
  const [form, setForm] = useState({
    supplier_id: "",
    invoice_no: "",
    order_date: "",
    ordered_by_user_id: "",
  });
  const [items, setItems] = useState([
    {
      medicine_id: "",
      qty_ordered: "",
      mfg_date: "",
      expiry_date: "",
      unit_cost: "",
    },
  ]);

  function handleItemChange(index, field, value) {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  }

  function addRow() {
    setItems([
      ...items,
      {
        medicine_id: "",
        qty_ordered: "",
        mfg_date: "",
        expiry_date: "",
        unit_cost: "",
      },
    ]);
  }
  function removeRow(i) {
    setItems(items.filter((_, idx) => idx !== i));
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-box" style={{ width: 640 }}>
        <h3>Add New Batch</h3>
        <div className="modal-body">
          <div className="form-grid" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label>Supplier</label>
              <select
                value={form.supplier_id}
                onChange={(e) =>
                  setForm({ ...form, supplier_id: e.target.value })
                }
              >
                <option value="">-- Select --</option>
                {suppliers.map((s) => (
                  <option key={s.supplier_id} value={s.supplier_id}>
                    {s.supplier_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Invoice No</label>
              <input
                value={form.invoice_no}
                onChange={(e) =>
                  setForm({ ...form, invoice_no: e.target.value })
                }
                placeholder="INV-MC-004"
              />
            </div>
            <div className="form-group">
              <label>Order Date</label>
              <input
                type="date"
                value={form.order_date}
                onChange={(e) =>
                  setForm({ ...form, order_date: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Ordered By</label>
              <select
                value={form.ordered_by_user_id}
                onChange={(e) =>
                  setForm({ ...form, ordered_by_user_id: e.target.value })
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

          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
            Batch Items
          </div>
          <div className="table-wrapper" style={{ marginBottom: 10 }}>
            <table>
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Qty</th>
                  <th>Mfg Date</th>
                  <th>Exp Date</th>
                  <th>Unit Cost</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td>
                      <select
                        value={item.medicine_id}
                        onChange={(e) =>
                          handleItemChange(i, "medicine_id", e.target.value)
                        }
                        style={{
                          width: "100%",
                          padding: "4px",
                          fontSize: 12,
                          border: "1px solid #ccc",
                          borderRadius: 3,
                        }}
                      >
                        <option value="">-- Select --</option>
                        {medicines.map((m) => (
                          <option key={m.medicine_id} value={m.medicine_id}>
                            {m.medicine_name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        value={item.qty_ordered}
                        onChange={(e) =>
                          handleItemChange(i, "qty_ordered", e.target.value)
                        }
                        style={{
                          width: 60,
                          padding: "4px",
                          fontSize: 12,
                          border: "1px solid #ccc",
                          borderRadius: 3,
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={item.mfg_date}
                        onChange={(e) =>
                          handleItemChange(i, "mfg_date", e.target.value)
                        }
                        style={{
                          fontSize: 12,
                          padding: "4px",
                          border: "1px solid #ccc",
                          borderRadius: 3,
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={item.expiry_date}
                        onChange={(e) =>
                          handleItemChange(i, "expiry_date", e.target.value)
                        }
                        style={{
                          fontSize: 12,
                          padding: "4px",
                          border: "1px solid #ccc",
                          borderRadius: 3,
                        }}
                      />
                    </td>
                    <td>
                      <input
                        value={item.unit_cost}
                        onChange={(e) =>
                          handleItemChange(i, "unit_cost", e.target.value)
                        }
                        placeholder="0.00"
                        style={{
                          width: 70,
                          padding: "4px",
                          fontSize: 12,
                          border: "1px solid #ccc",
                          borderRadius: 3,
                        }}
                      />
                    </td>
                    <td>
                      {items.length > 1 && (
                        <button
                          onClick={() => removeRow(i)}
                          style={{
                            color: "red",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: 14,
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={addRow}>
            + Add Row
          </button>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onSubmit({ ...form, items })}
          >
            Save Batch
          </button>
        </div>
      </div>
    </div>
  );
}

function Batches({ showToast }) {
  const [batches, setBatches] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function loadAll() {
    setLoading(true);
    Promise.all([
      apiFetch("/batches"),
      apiFetch("/medicines"),
      apiFetch("/suppliers"),
      apiFetch("/users"),
    ])
      .then(([b, m, s, u]) => {
        setBatches(b);
        setMedicines(m);
        setSuppliers(s);
        setUsers(u);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleAddBatch(data) {
    try {
      await apiFetch("/batches", {
        method: "POST",
        body: JSON.stringify(data),
      });
      setShowModal(false);
      showToast("Batch saved! Stock updated.", "success");
      loadAll();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Batches</h1>
          <p>Purchase orders and received stock</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Add New Batch
        </button>
      </div>

      {error && <div className="error-box">⚠ {error}</div>}

      <div className="card">
        {loading ? (
          <div className="loading">Loading batches…</div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Batch ID</th>
                  <th>Batch No</th>
                  <th>Supplier</th>
                  <th>Invoice No</th>
                  <th>Invoice Amount (Rs.)</th>
                  <th>Order Date</th>
                  <th>Received Date</th>
                  <th>Ordered By</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b, i) => (
                  <tr key={i}>
                    <td>{b.batch_id}</td>
                    <td>
                      <span className="td-primary">{b.batch_no}</span>
                    </td>
                    <td>{b.supplier_name || b.supplier}</td>
                    <td>{b.invoice_no}</td>
                    <td>
                      {parseFloat(
                        b.total_amount || b.invoice_amount || 0,
                      ).toLocaleString("en-NP", { minimumFractionDigits: 2 })}
                    </td>
                    <td>{b.order_date}</td>
                    <td>{b.received_date || "—"}</td>
                    <td>{b.ordered_by_name || b.ordered_by || "—"}</td>
                    <td>
                      <span
                        className={`badge ${b.batch_status === "received" || b.status === "received" ? "badge-green" : "badge-yellow"}`}
                      >
                        {b.batch_status || b.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {batches.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      style={{
                        textAlign: "center",
                        color: "#888",
                        padding: 20,
                      }}
                    >
                      No batches found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <AddBatchModal
          medicines={medicines}
          suppliers={suppliers}
          users={users}
          onClose={() => setShowModal(false)}
          onSubmit={handleAddBatch}
        />
      )}
    </div>
  );
}

export default Batches;
