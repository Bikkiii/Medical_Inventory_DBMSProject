import { useState } from "react";
import { sales, saleItems } from "../data/mockData.js";

function NewSaleModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    served_by: "Aayush Chhuka",
    payment_mode: "cash",
  });
  const [item, setItem] = useState({
    medicine: "Paracetamol 500mg",
    batch_item_id: "1",
    quantity_sold: "",
    unit_price: "",
    discount_pct: "0",
  });

  const set1 = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const set2 = (e) => setItem({ ...item, [e.target.name]: e.target.value });

  const subtotal =
    item.quantity_sold && item.unit_price
      ? (
          item.quantity_sold *
          item.unit_price *
          (1 - item.discount_pct / 100)
        ).toFixed(2)
      : "0.00";

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
      <div className="modal-box">
        <div className="modal-header">
          <h3>Process New Sale</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div
            style={{
              fontWeight: 600,
              fontSize: 12,
              color: "var(--text-3)",
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Customer Details
          </div>
          <div className="form-grid" style={{ marginBottom: 18 }}>
            <div className="form-group">
              <label>Customer Name</label>
              <input
                name="customer_name"
                value={form.customer_name}
                onChange={set1}
                placeholder="Ram Sharma"
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                name="customer_phone"
                value={form.customer_phone}
                onChange={set1}
                placeholder="9800000001"
              />
            </div>
            <div className="form-group">
              <label>Served By</label>
              <select name="served_by" value={form.served_by} onChange={set1}>
                <option>Aayush Chhuka</option>
                <option>Bikash Dhami</option>
                <option>Brishav Joshi</option>
                <option>Admin User</option>
              </select>
            </div>
            <div className="form-group">
              <label>Payment Mode</label>
              <select
                name="payment_mode"
                value={form.payment_mode}
                onChange={set1}
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
                <option value="insurance">Insurance</option>
              </select>
            </div>
          </div>

          <div
            style={{
              fontWeight: 600,
              fontSize: 12,
              color: "var(--text-3)",
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Medicine Item
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>Medicine</label>
              <select name="medicine" value={item.medicine} onChange={set2}>
                {medicines.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Batch Item ID</label>
              <input
                name="batch_item_id"
                value={item.batch_item_id}
                onChange={set2}
                type="number"
              />
            </div>
            <div className="form-group">
              <label>Quantity</label>
              <input
                name="quantity_sold"
                value={item.quantity_sold}
                onChange={set2}
                type="number"
                placeholder="5"
              />
            </div>
            <div className="form-group">
              <label>Unit Price (Rs.)</label>
              <input
                name="unit_price"
                value={item.unit_price}
                onChange={set2}
                placeholder="3.50"
              />
            </div>
            <div className="form-group">
              <label>Discount (%)</label>
              <input
                name="discount_pct"
                value={item.discount_pct}
                onChange={set2}
                type="number"
              />
            </div>
            <div className="form-group">
              <label>Subtotal (Rs.)</label>
              <input value={subtotal} readOnly />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-success"
            onClick={() =>
              onSubmit({ ...form, ...item, total_amount: subtotal })
            }
          >
            ✓ Confirm Sale
          </button>
        </div>
      </div>
    </div>
  );
}

function statusBadge(s) {
  return s === "completed"
    ? "badge-teal"
    : s === "partially_returned"
      ? "badge-yellow"
      : "badge-red";
}

function Sales({ showToast }) {
  const [showModal, setShowModal] = useState(false);
  const [selectedSale, setSelected] = useState(null);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Sales</h1>
          <p>Customer sales history</p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-success"
            onClick={() => setShowModal(true)}
          >
            + New Sale
          </button>
        </div>
      </div>

      <div className="card">
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
              {sales.map((s) => (
                <tr key={s.sale_id}>
                  <td className="td-primary">#{s.sale_id}</td>
                  <td className="td-muted">{s.sale_date}</td>
                  <td style={{ fontWeight: 500, color: "var(--text)" }}>
                    {s.customer_name}
                  </td>
                  <td className="td-muted">{s.customer_phone}</td>
                  <td className="td-muted">{s.served_by}</td>
                  <td
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--teal)",
                    }}
                  >
                    {s.total_amount.toFixed(2)}
                  </td>
                  <td>
                    <span className="badge badge-blue">{s.payment_mode}</span>
                  </td>
                  <td>
                    <span className={`badge ${statusBadge(s.sale_status)}`}>
                      {s.sale_status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        setSelected(
                          selectedSale === s.sale_id ? null : s.sale_id,
                        )
                      }
                    >
                      {selectedSale === s.sale_id ? "Hide" : "View"}
                    </button>
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <p>No sales recorded yet.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSale && (
        <div className="card">
          <div className="card-title">
            Sale #{selectedSale} — Line Items
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Item ID</th>
                  <th>Medicine</th>
                  <th>Batch No</th>
                  <th>Qty Sold</th>
                  <th>Unit Price</th>
                  <th>Discount %</th>
                  <th>Subtotal (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                {saleItems
                  .filter((i) => i.sale_id === selectedSale)
                  .map((i) => (
                    <tr key={i.sale_item_id}>
                      <td className="td-muted">{i.sale_item_id}</td>
                      <td style={{ fontWeight: 500, color: "var(--text)" }}>
                        {i.medicine_name}
                      </td>
                      <td className="td-primary">{i.batch_no}</td>
                      <td>{i.quantity_sold}</td>
                      <td
                        style={{
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 12,
                        }}
                      >
                        {i.unit_price.toFixed(2)}
                      </td>
                      <td>{i.discount_pct}%</td>
                      <td
                        style={{
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "var(--teal)",
                        }}
                      >
                        {i.subtotal.toFixed(2)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <NewSaleModal
          onClose={() => setShowModal(false)}
          onSubmit={(data) => {
            console.log(
              "CALL sp_process_sale(",
              data.customer_name,
              data.customer_phone,
              data.served_by,
              data.payment_mode,
              data.batch_item_id,
              data.quantity_sold,
              data.unit_price,
              data.discount_pct,
              ");",
            );
            setShowModal(false);
            showToast("Sale completed successfully.", "success");
          }}
        />
      )}
    </div>
  );
}

export default Sales;
