import { useState } from "react";
import { batches } from "../data/mockData.js";

function AddBatchModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    supplier: "MedCo Pharmaceuticals",
    invoice_no: "",
    order_date: "",
    notes: "",
  });
  const [items, setItems] = useState([
    {
      medicine: "Paracetamol 500mg",
      qty_ordered: "",
      mfg_date: "",
      exp_date: "",
      unit_price: "",
    },
  ]);

  const setForm1 = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const setItem = (i, e) => {
    const u = [...items];
    u[i][e.target.name] = e.target.value;
    setItems(u);
  };
  const addRow = () =>
    setItems([
      ...items,
      {
        medicine: "Paracetamol 500mg",
        qty_ordered: "",
        mfg_date: "",
        exp_date: "",
        unit_price: "",
      },
    ]);
  const delRow = (i) => setItems(items.filter((_, j) => j !== i));

  const medicines = [
    "Paracetamol 500mg",
    "Amoxicillin 250mg",
    "Vitamin C 500mg",
    "Azithromycin 500mg",
    "ORS Sachet",
    "Cetirizine 10mg",
    "Metformin 500mg",
    "Betadine Solution",
  ];

  return (
    <div className="modal-backdrop">
      <div className="modal-box" style={{ width: 640 }}>
        <div className="modal-header">
          <h3>Add New Batch</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="form-grid" style={{ marginBottom: 18 }}>
            <div className="form-group">
              <label>Batch No (Auto)</label>
              <input value="BCH-2026-0004" readOnly />
            </div>
            <div className="form-group">
              <label>Supplier</label>
              <select name="supplier" value={form.supplier} onChange={setForm1}>
                <option>MedCo Pharmaceuticals</option>
                <option>PharmX Distributors</option>
                <option>Nepal Drug House</option>
              </select>
            </div>
            <div className="form-group">
              <label>Invoice No</label>
              <input
                name="invoice_no"
                value={form.invoice_no}
                onChange={setForm1}
                placeholder="INV-MC-004"
              />
            </div>
            <div className="form-group">
              <label>Order Date</label>
              <input
                name="order_date"
                type="date"
                value={form.order_date}
                onChange={setForm1}
              />
            </div>
            <div className="form-group full-width">
              <label>Notes (optional)</label>
              <input
                name="notes"
                value={form.notes}
                onChange={setForm1}
                placeholder="Any notes..."
              />
            </div>
          </div>

          <div
            style={{
              fontWeight: 600,
              fontSize: 13,
              color: "var(--text-2)",
              marginBottom: 10,
            }}
          >
            Batch Items
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Qty Ordered</th>
                  <th>Mfg Date</th>
                  <th>Exp Date</th>
                  <th>Unit Price (Rs.)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td>
                      <select
                        name="medicine"
                        value={item.medicine}
                        onChange={(e) => setItem(i, e)}
                        className="table-input"
                      >
                        {medicines.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        name="qty_ordered"
                        value={item.qty_ordered}
                        onChange={(e) => setItem(i, e)}
                        type="number"
                        className="table-input"
                        style={{ width: 70 }}
                      />
                    </td>
                    <td>
                      <input
                        name="mfg_date"
                        value={item.mfg_date}
                        onChange={(e) => setItem(i, e)}
                        type="date"
                        className="table-input"
                      />
                    </td>
                    <td>
                      <input
                        name="exp_date"
                        value={item.exp_date}
                        onChange={(e) => setItem(i, e)}
                        type="date"
                        className="table-input"
                      />
                    </td>
                    <td>
                      <input
                        name="unit_price"
                        value={item.unit_price}
                        onChange={(e) => setItem(i, e)}
                        placeholder="0.00"
                        className="table-input"
                        style={{ width: 80 }}
                      />
                    </td>
                    <td style={{ width: 30 }}>
                      {items.length > 1 && (
                        <button
                          onClick={() => delRow(i)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--red)",
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
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 10 }}
            onClick={addRow}
          >
            + Add Row
          </button>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onSubmit(form, items)}
          >
            Save as Pending
          </button>
        </div>
      </div>
    </div>
  );
}

function Batches({ showToast }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Batches</h1>
          <p>Procurement records from suppliers</p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-primary"
            onClick={() => setShowModal(true)}
          >
            + New Batch
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Batch No</th>
                <th>Supplier</th>
                <th>Invoice No</th>
                <th>Invoice Amount</th>
                <th>Order Date</th>
                <th>Received Date</th>
                <th>Ordered By</th>
                <th>Received By</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.batch_id}>
                  <td className="td-muted">{b.batch_id}</td>
                  <td className="td-primary">{b.batch_no}</td>
                  <td style={{ fontWeight: 500, color: "var(--text)" }}>
                    {b.supplier}
                  </td>
                  <td className="td-muted">{b.invoice_no}</td>
                  <td
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 12,
                      color: "var(--teal)",
                      fontWeight: 500,
                    }}
                  >
                    Rs.{" "}
                    {b.invoice_amount.toLocaleString("en-NP", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="td-muted">{b.order_date}</td>
                  <td className="td-muted">{b.received_date || "—"}</td>
                  <td className="td-muted">{b.ordered_by}</td>
                  <td className="td-muted">{b.received_by || "—"}</td>
                  <td>
                    <span
                      className={`badge ${b.batch_status === "received" ? "badge-teal" : "badge-yellow"}`}
                    >
                      {b.batch_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <AddBatchModal
          onClose={() => setShowModal(false)}
          onSubmit={(form, items) => {
            console.log("INSERT INTO batch:", form);
            console.log("INSERT INTO batch_item:", items);
            setShowModal(false);
            showToast("Batch created with status: pending.", "success");
          }}
        />
      )}
    </div>
  );
}

export default Batches;
