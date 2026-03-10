import { useState } from "react";
import { returns } from "../data/mockData.js";

function ReturnModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    sale_item_id: "",
    quantity_returned: "",
    reason: "wrong_medicine",
    resolution: "refund",
    processed_by: "Aayush Chhuka",
  });
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  return (
    <div className="modal-backdrop">
      <div className="modal-box">
        <div className="modal-header">
          <h3>Process Customer Return</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            Calls <code>sp_process_return</code> — updates stock ledger and sale
            status.
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>Sale Item ID</label>
              <input
                name="sale_item_id"
                value={form.sale_item_id}
                onChange={set}
                type="number"
                placeholder="e.g. 1"
              />
            </div>
            <div className="form-group">
              <label>Quantity to Return</label>
              <input
                name="quantity_returned"
                value={form.quantity_returned}
                onChange={set}
                type="number"
                placeholder="e.g. 2"
              />
            </div>
            <div className="form-group">
              <label>Reason</label>
              <select name="reason" value={form.reason} onChange={set}>
                <option value="wrong_medicine">Wrong Medicine</option>
                <option value="damaged">Damaged</option>
                <option value="expired">Expired</option>
                <option value="side_effect">Side Effect</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Resolution</label>
              <select name="resolution" value={form.resolution} onChange={set}>
                <option value="refund">Refund</option>
                <option value="replacement">Replacement</option>
                <option value="pending">Pending</option>
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
                <option>Brishav Joshi</option>
                <option>Admin User</option>
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>
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

const TYPE_BADGE = {
  customer_return: "badge-yellow",
  damage_report: "badge-red",
  supplier_return: "badge-orange",
};
const RES_BADGE = {
  refund: "badge-blue",
  write_off: "badge-red",
  replacement: "badge-teal",
  return_to_supplier: "badge-orange",
  pending: "badge-gray",
};

function Returns({ showToast }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Returns &amp; Damage Reports</h1>
          <p>Customer returns and damage write-offs</p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-warning"
            onClick={() => setShowModal(true)}
          >
            + Process Return
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
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
              {returns.map((r) => (
                <tr key={r.return_id}>
                  <td className="td-muted">{r.return_id}</td>
                  <td>
                    <span
                      className={`badge ${TYPE_BADGE[r.return_type] || "badge-gray"}`}
                    >
                      {r.return_type.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="td-muted">{r.return_date}</td>
                  <td style={{ fontWeight: 500, color: "var(--text)" }}>
                    {r.medicine_name}
                  </td>
                  <td className="td-primary">{r.batch_no}</td>
                  <td>{r.quantity_returned}</td>
                  <td className="td-muted">{r.reason.replace(/_/g, " ")}</td>
                  <td>
                    <span
                      className={`badge ${RES_BADGE[r.resolution] || "badge-gray"}`}
                    >
                      {r.resolution.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td
                    style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}
                  >
                    {r.refund_amount != null
                      ? `Rs. ${r.refund_amount.toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="td-muted">{r.processed_by}</td>
                </tr>
              ))}
              {returns.length === 0 && (
                <tr>
                  <td colSpan={10}>
                    <div className="empty-state">
                      <p>No returns recorded.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <ReturnModal
          onClose={() => setShowModal(false)}
          onSubmit={(form) => {
            console.log(
              "CALL sp_process_return(",
              form.sale_item_id,
              form.quantity_returned,
              form.reason,
              form.resolution,
              ");",
            );
            setShowModal(false);
            showToast("Return processed successfully.", "success");
          }}
        />
      )}
    </div>
  );
}

export default Returns;
