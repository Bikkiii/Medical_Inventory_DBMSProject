import { useState, useEffect } from "react";
import { apiFetch } from "../api.js";

function ReturnModal({ users, onClose, onSubmit }) {
  const [form, setForm] = useState({
    sale_id: "",
    sale_item_id: "",
    qty_returned: "",
    reason: "wrong_medicine",
    resolution: "refund",
    processed_by_user_id: "",
  });
  return (
    <div className="modal-backdrop">
      <div className="modal-box">
        <h3>Process Customer Return</h3>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Sale ID</label>
              <input
                type="number"
                value={form.sale_id}
                onChange={(e) => setForm({ ...form, sale_id: e.target.value })}
                placeholder="e.g. 1"
              />
            </div>
            <div className="form-group">
              <label>Sale Item ID</label>
              <input
                type="number"
                value={form.sale_item_id}
                onChange={(e) =>
                  setForm({ ...form, sale_item_id: e.target.value })
                }
                placeholder="e.g. 1"
              />
            </div>
            <div className="form-group">
              <label>Quantity to Return</label>
              <input
                type="number"
                value={form.qty_returned}
                onChange={(e) =>
                  setForm({ ...form, qty_returned: e.target.value })
                }
                placeholder="e.g. 2"
              />
            </div>
            <div className="form-group">
              <label>Reason</label>
              <select
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              >
                <option value="wrong_medicine">Wrong Medicine</option>
                <option value="damaged">Damaged</option>
                <option value="expired">Expired</option>
                <option value="side_effect">Side Effect</option>
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
                <option value="refund">Refund</option>
                <option value="replacement">Replacement</option>
                <option value="pending">Pending</option>
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
          <button className="btn btn-warning" onClick={() => onSubmit(form)}>
            Process Return
          </button>
        </div>
      </div>
    </div>
  );
}

function Returns({ showToast }) {
  const [returns, setReturns] = useState([]);
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function loadAll() {
    setLoading(true);
    Promise.all([apiFetch("/returns"), apiFetch("/users")])
      .then(([r, u]) => {
        setReturns(r);
        setUsers(u);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleReturnSubmit(form) {
    try {
      await apiFetch("/returns/customer", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setShowModal(false);
      showToast("Return processed successfully.", "success");
      loadAll();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function typeBadge(type) {
    if (type === "customer_return") return "badge-yellow";
    if (type === "damage_report") return "badge-red";
    if (type === "supplier_return") return "badge-orange";
    return "badge-gray";
  }

  function resBadge(res) {
    if (res === "refund") return "badge-blue";
    if (res === "write_off") return "badge-red";
    if (res === "replacement") return "badge-green";
    if (res === "return_to_supplier") return "badge-orange";
    return "badge-gray";
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Returns & Damage Reports</h1>
          <p>Customer returns and write-offs</p>
        </div>
        <button className="btn btn-warning" onClick={() => setShowModal(true)}>
          + Process Return
        </button>
      </div>

      {error && <div className="error-box">⚠ {error}</div>}

      <div className="card">
        {loading ? (
          <div className="loading">Loading returns…</div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Return ID</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Medicine</th>
                  <th>Batch No</th>
                  <th>Qty</th>
                  <th>Reason</th>
                  <th>Resolution</th>
                  <th>Refund (Rs.)</th>
                  <th>Processed By</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((r, i) => (
                  <tr key={i}>
                    <td>{r.return_id}</td>
                    <td>
                      <span
                        className={`badge ${typeBadge(r.return_type || r.type)}`}
                      >
                        {(r.return_type || r.type || "").replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>{r.return_date || r.date}</td>
                    <td>{r.medicine_name || r.medicine}</td>
                    <td>{r.batch_no || r.batch}</td>
                    <td>{r.qty_returned || r.quantity_returned || r.qty}</td>
                    <td>{(r.reason || "").replace(/_/g, " ")}</td>
                    <td>
                      <span className={`badge ${resBadge(r.resolution)}`}>
                        {(r.resolution || "").replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>
                      {r.refund_amount != null
                        ? parseFloat(r.refund_amount).toFixed(2)
                        : "—"}
                    </td>
                    <td>{r.processed_by_name || r.processed_by}</td>
                  </tr>
                ))}
                {returns.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      style={{
                        textAlign: "center",
                        color: "#888",
                        padding: 20,
                      }}
                    >
                      No returns recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <ReturnModal
          users={users}
          onClose={() => setShowModal(false)}
          onSubmit={handleReturnSubmit}
        />
      )}
    </div>
  );
}

export default Returns;
