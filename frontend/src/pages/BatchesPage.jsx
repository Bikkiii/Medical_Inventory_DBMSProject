import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, apiPost } from "../api";
import { useToast } from "../hooks/useToast";
import { useAuth } from "../hooks/useAuth";

// ──────────────────────────────────────────
//  Batches List Page
// ──────────────────────────────────────────
export function BatchesPage() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [detail, setDetail]   = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch("/batches")
      .then(setBatches)
      .catch(() => setBatches([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = batches.filter(b =>
    !search ||
    b.batch_no?.toLowerCase().includes(search.toLowerCase()) ||
    b.supplier_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div><h1>Batches</h1><p>All stock deliveries</p></div>
        <div className="page-header-actions">
          <button className="btn btn-primary btn-sm" onClick={() => navigate("/batches/new")}>+ New Batch</button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-wrapper">
          <input className="search-bar" placeholder="Search batch no or supplier…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? <div className="loading">Loading…</div> : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Batch No</th><th>Supplier</th><th>Received By</th>
                  <th>Date</th><th>Invoice No</th><th>Invoice Amt</th><th>Items</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="empty-state">No batches found. <button className="btn btn-primary btn-sm" onClick={() => navigate("/batches/new")}>Create first batch</button></td></tr>
                ) : filtered.map(b => (
                  <tr key={b.batch_id}>
                    <td className="td-primary">{b.batch_no}</td>
                    <td>{b.supplier_name}</td>
                    <td className="td-muted">{b.received_by_name}</td>
                    <td>{new Date(b.received_date).toLocaleDateString()}</td>
                    <td className="td-muted">{b.invoice_no || "—"}</td>
                    <td>Rs. {parseFloat(b.invoice_amount || 0).toFixed(2)}</td>
                    <td><span className="badge badge-blue">{b.items?.length || 0} items</span></td>
                    <td><button className="btn btn-secondary btn-xs" onClick={() => setDetail(b)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detail && <BatchDetailModal batch={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function BatchDetailModal({ batch, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box modal-lg" onClick={e => e.stopPropagation()}>
        <h3>Batch Detail — {batch.batch_no}</h3>
        <div className="modal-body">
          <div className="form-grid" style={{ marginBottom: 16 }}>
            <div><span className="td-muted">Supplier</span><br /><strong>{batch.supplier_name}</strong></div>
            <div><span className="td-muted">Received By</span><br /><strong>{batch.received_by_name}</strong></div>
            <div><span className="td-muted">Date</span><br /><strong>{new Date(batch.received_date).toLocaleDateString()}</strong></div>
            <div><span className="td-muted">Invoice No</span><br /><strong>{batch.invoice_no || "—"}</strong></div>
            <div><span className="td-muted">Invoice Amount</span><br /><strong>Rs. {parseFloat(batch.invoice_amount || 0).toFixed(2)}</strong></div>
            {batch.notes && <div className="form-group full-width"><span className="td-muted">Notes</span><br />{batch.notes}</div>}
          </div>

          <div className="section-title" style={{ marginBottom: 10 }}>Medicines ({batch.items?.length})</div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Medicine</th><th>Qty</th><th>Mfg Date</th><th>Expiry</th><th>Unit Price</th></tr>
              </thead>
              <tbody>
                {(batch.items || []).map((item, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.medicine_name}</div>
                      <div className="td-muted">{item.brand_name} {item.strength}</div>
                    </td>
                    <td><strong>{item.quantity_received}</strong></td>
                    <td>{new Date(item.manufacture_date).toLocaleDateString()}</td>
                    <td>{new Date(item.expiry_date).toLocaleDateString()}</td>
                    <td>Rs. {parseFloat(item.unit_price).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
//  Add New Batch Page
// ──────────────────────────────────────────
const EMPTY_ITEM = () => ({
  medicine_id: "", quantity_received: "", manufacture_date: "",
  expiry_date: "", unit_price: "", _errors: {}
});

function genBatchNo() {
  const year = new Date().getFullYear();
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `BCH-${year}-${rand}`;
}

export function AddBatchPage() {
  const [suppliers,  setSuppliers]  = useState([]);
  const [medicines,  setMedicines]  = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [showAddSup, setShowAddSup] = useState(false);

  const { user } = useAuth();
  const showToast = useToast();
  const navigate  = useNavigate();

  const today = new Date().toISOString().split("T")[0];

  const [header, setHeader] = useState({
    batch_no:      genBatchNo(),
    supplier_id:   "",
    received_date: today,
    invoice_no:    "",
    notes:         "",
  });
  const [items,  setItems]  = useState([EMPTY_ITEM()]);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    apiFetch("/suppliers").then(setSuppliers).catch(() => {});
    apiFetch("/medicines").then(setMedicines).catch(() => {});
  }, []);

  function updateHeader(k, v) { setHeader(h => ({ ...h, [k]: v })); }

  function updateItem(idx, k, v) {
    setItems(items => items.map((it, i) => i === idx ? { ...it, [k]: v } : it));
  }

  function addItem() { setItems(items => [...items, EMPTY_ITEM()]); }
  function removeItem(idx) { setItems(items => items.filter((_, i) => i !== idx)); }

  function validate() {
    const errs = {};
    if (!header.supplier_id) errs.supplier_id = "Supplier is required";
    if (!header.received_date) errs.received_date = "Date is required";

    const itemErrs = items.map(it => {
      const e = {};
      if (!it.medicine_id)      e.medicine_id      = "Required";
      if (!it.quantity_received || it.quantity_received <= 0) e.quantity_received = "Must be > 0";
      if (!it.manufacture_date) e.manufacture_date = "Required";
      if (!it.expiry_date)      e.expiry_date      = "Required";
      if (it.manufacture_date && it.expiry_date && it.expiry_date <= it.manufacture_date)
        e.expiry_date = "Must be after manufacture date";
      if (!it.unit_price || it.unit_price <= 0) e.unit_price = "Must be > 0";
      return e;
    });

    const hasItemErrors = itemErrs.some(e => Object.keys(e).length > 0);
    if (hasItemErrors) errs.items = itemErrs;
    return errs;
  }

  async function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    try {
      const body = {
        batch_no:      header.batch_no,
        supplier_id:   parseInt(header.supplier_id),
        received_by:   user.user_id,
        received_date: header.received_date,
        invoice_no:    header.invoice_no || null,
        notes:         header.notes      || null,
        items: items.map(it => ({
          medicine_id:       parseInt(it.medicine_id),
          quantity_received: parseInt(it.quantity_received),
          manufacture_date:  it.manufacture_date,
          expiry_date:       it.expiry_date,
          unit_price:        parseFloat(it.unit_price),
        })),
      };
      await apiPost("/batches", body);
      showToast("Batch created successfully!", "success");
      navigate("/batches");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>New Batch</h1>
          <p>Record a new medicine delivery</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate("/batches")}>← Back</button>
      </div>

      {/* Header */}
      <div className="card">
        <div className="section-title">Step 1 — Batch Details</div>
        <div className="form-grid">
          <div className="form-group">
            <label>Batch No</label>
            <input type="text" value={header.batch_no} readOnly />
          </div>
          <div className="form-group">
            <label>Supplier *</label>
            <div style={{ display: "flex", gap: 8 }}>
              <select
                value={header.supplier_id}
                onChange={e => updateHeader("supplier_id", e.target.value)}
                className={errors.supplier_id ? "error" : ""}
                style={{ flex: 1 }}
              >
                <option value="">Select supplier…</option>
                {suppliers.map(s => (
                  <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name} ({s.phone})</option>
                ))}
              </select>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddSup(true)}>+</button>
            </div>
            {errors.supplier_id && <span className="form-error">{errors.supplier_id}</span>}
          </div>
          <div className="form-group">
            <label>Received Date *</label>
            <input type="date" value={header.received_date} onChange={e => updateHeader("received_date", e.target.value)} />
            {errors.received_date && <span className="form-error">{errors.received_date}</span>}
          </div>
          <div className="form-group">
            <label>Invoice No</label>
            <input type="text" placeholder="e.g. INV-2025-001" value={header.invoice_no} onChange={e => updateHeader("invoice_no", e.target.value)} />
          </div>
          <div className="form-group full-width">
            <label>Notes</label>
            <textarea value={header.notes} onChange={e => updateHeader("notes", e.target.value)} placeholder="Any notes about this delivery…" />
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="card">
        <div className="section-title">
          Step 2 — Add Medicines
          <button className="btn btn-secondary btn-sm" onClick={addItem}>+ Add Row</button>
        </div>

        <div className="item-row-header">
          <span>Medicine *</span><span>Qty Received *</span>
          <span>Mfg Date *</span><span>Expiry Date *</span>
          <span>Unit Price (Rs.) *</span><span></span>
        </div>

        {items.map((item, idx) => {
          const itemErr = errors.items?.[idx] || {};
          return (
            <div key={idx} className="item-row">
              <div className="form-group" style={{ margin: 0 }}>
                <select
                  value={item.medicine_id}
                  onChange={e => updateItem(idx, "medicine_id", e.target.value)}
                  className={itemErr.medicine_id ? "error" : ""}
                >
                  <option value="">Select medicine…</option>
                  {medicines.map(m => (
                    <option key={m.medicine_id} value={m.medicine_id}>
                      {m.medicine_name}{m.strength ? ` — ${m.strength}` : ""}{m.brand_name ? ` (${m.brand_name})` : ""}
                    </option>
                  ))}
                </select>
                {itemErr.medicine_id && <span className="form-error">{itemErr.medicine_id}</span>}
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <input type="number" min={1} placeholder="50" value={item.quantity_received}
                  onChange={e => updateItem(idx, "quantity_received", e.target.value)}
                  className={itemErr.quantity_received ? "error" : ""} />
                {itemErr.quantity_received && <span className="form-error">{itemErr.quantity_received}</span>}
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <input type="date" value={item.manufacture_date}
                  onChange={e => updateItem(idx, "manufacture_date", e.target.value)}
                  className={itemErr.manufacture_date ? "error" : ""} />
                {itemErr.manufacture_date && <span className="form-error">{itemErr.manufacture_date}</span>}
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <input type="date" value={item.expiry_date}
                  onChange={e => updateItem(idx, "expiry_date", e.target.value)}
                  className={itemErr.expiry_date ? "error" : ""} />
                {itemErr.expiry_date && <span className="form-error">{itemErr.expiry_date}</span>}
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <input type="number" min={0} step="0.01" placeholder="3.50" value={item.unit_price}
                  onChange={e => updateItem(idx, "unit_price", e.target.value)}
                  className={itemErr.unit_price ? "error" : ""} />
                {itemErr.unit_price && <span className="form-error">{itemErr.unit_price}</span>}
              </div>
              <button className="remove-btn" onClick={() => removeItem(idx)} disabled={items.length === 1}>×</button>
            </div>
          );
        })}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={() => navigate("/batches")}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving…" : "💾 Save Batch"}
          </button>
        </div>
      </div>

      {showAddSup && (
        <AddSupplierModal
          onClose={() => setShowAddSup(false)}
          onSaved={(newSup) => {
            setSuppliers(s => [...s, newSup]);
            updateHeader("supplier_id", String(newSup.supplier_id));
            setShowAddSup(false);
          }}
        />
      )}
    </div>
  );
}

function AddSupplierModal({ onClose, onSaved }) {
  const [form, setForm]       = useState({ supplier_name: "", phone: "", email: "", address: "" });
  const [loading, setLoading] = useState(false);
  const showToast = useToast();

  async function handleSave() {
    if (!form.supplier_name || !form.phone) { showToast("Name and phone are required", "error"); return; }
    setLoading(true);
    try {
      const res = await apiPost("/suppliers", form);
      showToast("Supplier added!", "success");
      onSaved({ ...form, supplier_id: res.supplierId });
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3>Add New Supplier</h3>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Supplier Name *</label>
              <input value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} placeholder="e.g. Himalayan Pharma" />
            </div>
            <div className="form-group">
              <label>Phone *</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="98XXXXXXXX" />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="supplier@email.com" />
            </div>
            <div className="form-group full-width">
              <label>Address</label>
              <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Full address…" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={loading}>
            {loading ? "Saving…" : "Save Supplier"}
          </button>
        </div>
      </div>
    </div>
  );
}
