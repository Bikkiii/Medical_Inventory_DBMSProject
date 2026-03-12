import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, apiPost } from "../api";
import { useToast } from "../hooks/useToast";
import { useAuth } from "../hooks/useAuth";

const statusBadge = {
  completed:          "badge-green",
  partially_returned: "badge-orange",
  fully_returned:     "badge-gray",
};

// ──────────────────────────────────────────
//  Sales List
// ──────────────────────────────────────────
export function SalesPage() {
  const [sales, setSales]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [payFilter, setPayFilter]       = useState("all");
  const [detail, setDetail] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch("/sales")
      .then(setSales)
      .catch(() => setSales([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = sales.filter(s => {
    if (search && !s.customer_name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && s.sale_status !== statusFilter) return false;
    if (payFilter    !== "all" && s.payment_mode !== payFilter)   return false;
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div><h1>Sales</h1><p>All customer transactions</p></div>
        <button className="btn btn-primary btn-sm" onClick={() => navigate("/sales/new")}>+ New Sale</button>
      </div>

      <div className="filter-bar">
        <div className="search-wrapper">
          <input className="search-bar" placeholder="Search customer…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="partially_returned">Partially Returned</option>
          <option value="fully_returned">Fully Returned</option>
        </select>
        <select value={payFilter} onChange={e => setPayFilter(e.target.value)}>
          <option value="all">All Payment</option>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="upi">UPI</option>
          <option value="insurance">Insurance</option>
        </select>
      </div>

      {loading ? <div className="loading">Loading…</div> : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Customer</th><th>Served By</th>
                  <th>Date</th><th>Payment</th><th>Total</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="empty-state">No sales found.</td></tr>
                ) : filtered.map(s => (
                  <tr key={s.sale_id}>
                    <td className="td-primary">{s.sale_id}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.customer_name}</div>
                      <div className="td-muted">{s.customer_phone}</div>
                    </td>
                    <td className="td-muted">{s.served_by_full_name}</td>
                    <td className="td-muted">{new Date(s.sale_date).toLocaleString()}</td>
                    <td><span className="badge badge-blue">{s.payment_mode}</span></td>
                    <td style={{ fontWeight: 700 }}>Rs. {parseFloat(s.total_amount).toFixed(2)}</td>
                    <td><span className={`badge ${statusBadge[s.sale_status] || "badge-gray"}`}>{s.sale_status.replace(/_/g, " ")}</span></td>
                    <td>
                      <button className="btn btn-secondary btn-xs" onClick={() => {
                        apiFetch(`/sales/${s.sale_id}`).then(setDetail);
                      }}>View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detail && <SaleDetailModal sale={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function SaleDetailModal({ sale, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box modal-lg" onClick={e => e.stopPropagation()}>
        <h3>Sale #{sale.sale_id} — {sale.customer_name}</h3>
        <div className="modal-body">
          <div className="form-grid" style={{ marginBottom: 16 }}>
            <div><span className="td-muted">Customer</span><br /><strong>{sale.customer_name}</strong> {sale.customer_phone && `(${sale.customer_phone})`}</div>
            <div><span className="td-muted">Served By</span><br /><strong>{sale.served_by_full_name}</strong></div>
            <div><span className="td-muted">Date</span><br /><strong>{new Date(sale.sale_date).toLocaleString()}</strong></div>
            <div><span className="td-muted">Payment</span><br /><span className="badge badge-blue">{sale.payment_mode}</span></div>
            <div><span className="td-muted">Status</span><br /><span className={`badge ${statusBadge[sale.sale_status]}`}>{sale.sale_status.replace(/_/g," ")}</span></div>
            <div><span className="td-muted">Total</span><br /><strong style={{ fontSize: 18, color: "var(--teal)" }}>Rs. {parseFloat(sale.total_amount).toFixed(2)}</strong></div>
          </div>
          <div className="section-title" style={{ marginBottom: 10 }}>Items</div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Medicine</th><th>Batch</th><th>Qty</th><th>Price</th><th>Disc%</th><th>Subtotal</th></tr></thead>
              <tbody>
                {(sale.items || []).map((it, i) => (
                  <tr key={i}>
                    <td><div style={{ fontWeight: 600 }}>{it.medicine_name}</div><div className="td-muted">{it.brand_name} {it.strength}</div></td>
                    <td className="td-primary">{it.batch_no}</td>
                    <td>{it.quantity_sold}</td>
                    <td>Rs. {parseFloat(it.unit_price).toFixed(2)}</td>
                    <td>{it.discount_pct}%</td>
                    <td style={{ fontWeight: 600 }}>Rs. {parseFloat(it.subtotal).toFixed(2)}</td>
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
//  New Sale Page
// ──────────────────────────────────────────
const EMPTY_SALE_ITEM = () => ({
  batch_item_id: "", medicine_id: "", quantity_sold: 1,
  unit_price: "", discount_pct: 0, _maxQty: 0, _label: ""
});

export function NewSalePage() {
  const [stock,   setStock]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [customer, setCustomer] = useState({ name: "", phone: "", payment_mode: "cash" });
  const [items,    setItems]    = useState([EMPTY_SALE_ITEM()]);
  const [errors,   setErrors]   = useState({});

  const { user }  = useAuth();
  const showToast = useToast();
  const navigate  = useNavigate();

  useEffect(() => {
    setLoading(true);
    apiFetch("/inventory/current-stock")
      .then(data => {
        const avail = data.filter(r =>
          r.current_stock > 0 &&
          r.expiry_status !== "expired" &&
          r.medicine_active !== false
        );
        setStock(avail);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function updateCustomer(k, v) { setCustomer(c => ({ ...c, [k]: v })); }

  function pickStock(idx, val) {
    const row = stock.find(r => String(r.batch_item_id) === String(val));
    if (!row) return;
    setItems(items => items.map((it, i) =>
      i === idx ? {
        ...it,
        batch_item_id: row.batch_item_id,
        medicine_id:   row.medicine_id || it.medicine_id,
        unit_price:    row.unit_price,
        _maxQty:       row.current_stock,
        _label:        `${row.medicine_name} | Batch: ${row.batch_no} | Exp: ${new Date(row.expiry_date).toLocaleDateString()} | Stock: ${row.current_stock}`,
      } : it
    ));
  }

  function updateItem(idx, k, v) {
    setItems(items => items.map((it, i) => i === idx ? { ...it, [k]: v } : it));
  }

  function addItem()       { setItems(it => [...it, EMPTY_SALE_ITEM()]); }
  function removeItem(idx) { setItems(it => it.filter((_, i) => i !== idx)); }

  function calcSubtotal(it) {
    const qty   = parseFloat(it.quantity_sold)  || 0;
    const price = parseFloat(it.unit_price)     || 0;
    const disc  = parseFloat(it.discount_pct)   || 0;
    return qty * price * (1 - disc / 100);
  }

  const total = items.reduce((sum, it) => sum + calcSubtotal(it), 0);

  function validate() {
    const errs = {};
    if (!customer.name) errs.customer_name = "Customer name is required";
    if (!customer.payment_mode) errs.payment_mode = "Payment mode required";

    const counts = {};
    items.forEach(it => {
      if (!it.batch_item_id) return;
      counts[it.batch_item_id] = (counts[it.batch_item_id] || 0) + 1;
    });

    const itemErrs = items.map(it => {
      const e = {};
      if (!it.batch_item_id) e.batch_item_id = "Select a medicine";
      if (it.batch_item_id && counts[it.batch_item_id] > 1) e.batch_item_id = "Duplicate batch selected";
      if (!it.quantity_sold || it.quantity_sold <= 0) e.quantity_sold = "Must be > 0";
      if (it._maxQty && it.quantity_sold > it._maxQty) e.quantity_sold = `Max available: ${it._maxQty}`;
      if (!it.unit_price || it.unit_price <= 0) e.unit_price = "Must be > 0";
      return e;
    });
    if (itemErrs.some(e => Object.keys(e).length > 0)) errs.items = itemErrs;
    return errs;
  }

  async function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      const stockMap = {};
      stock.forEach(r => { stockMap[r.batch_item_id] = r.medicine_id; });

      const body = {
        customer_name:  customer.name,
        customer_phone: customer.phone || null,
        served_by:      user.user_id,
        payment_mode:   customer.payment_mode,
        items: items.map(it => ({
          batch_item_id: parseInt(it.batch_item_id),
          medicine_id:   stockMap[it.batch_item_id] ?? (it.medicine_id ? parseInt(it.medicine_id) : null),
          quantity_sold: parseInt(it.quantity_sold),
          unit_price:    parseFloat(it.unit_price),
          discount_pct:  parseFloat(it.discount_pct) || 0,
        })),
      };
      const res = await apiPost("/sales", body);
      showToast(`Sale completed! Sale ID: ${res.saleId}`, "success");
      navigate("/sales");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="loading">Loading stock…</div>;

  return (
    <div>
      <div className="page-header">
        <div><h1>New Sale</h1><p>Process a customer sale</p></div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate("/sales")}>← Back</button>
      </div>

      {/* Customer Info */}
      <div className="card">
        <div className="section-title">Step 1 — Customer Info</div>
        <div className="form-grid">
          <div className="form-group">
            <label>Customer Name *</label>
            <input value={customer.name} onChange={e => updateCustomer("name", e.target.value)}
              placeholder="Patient name" className={errors.customer_name ? "error" : ""} />
            {errors.customer_name && <span className="form-error">{errors.customer_name}</span>}
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input value={customer.phone} onChange={e => updateCustomer("phone", e.target.value)} placeholder="98XXXXXXXX" />
          </div>
          <div className="form-group">
            <label>Payment Mode *</label>
            <select value={customer.payment_mode} onChange={e => updateCustomer("payment_mode", e.target.value)}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
              <option value="insurance">Insurance</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bill Items */}
      <div className="card">
        <div className="section-title">
          Step 2 — Add Medicines
          <button className="btn btn-secondary btn-sm" onClick={addItem}>+ Add Row</button>
        </div>

        {items.map((item, idx) => {
          const ie = errors.items?.[idx] || {};
          const sub = calcSubtotal(item);
          return (
            <div key={idx} style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 14, marginBottom: 10, background: "var(--surface-2)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr 1fr 36px", gap: 10, alignItems: "end" }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Medicine & Batch</label>
                  <select value={item.batch_item_id} onChange={e => pickStock(idx, e.target.value)}
                    className={ie.batch_item_id ? "error" : ""}>
                    <option value="">Select medicine + batch…</option>
                    {stock.map(r => (
                      <option key={r.batch_item_id} value={r.batch_item_id}>
                        {r.medicine_name} | Batch: {r.batch_no} | Exp: {new Date(r.expiry_date).toLocaleDateString()} | Stock: {r.current_stock}
                      </option>
                    ))}
                  </select>
                  {ie.batch_item_id && <span className="form-error">{ie.batch_item_id}</span>}
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Qty (Max {item._maxQty || "—"})</label>
                  <input type="number" min={1} max={item._maxQty || 9999}
                    value={item.quantity_sold}
                    onChange={e => updateItem(idx, "quantity_sold", e.target.value)}
                    className={ie.quantity_sold ? "error" : ""} />
                  {ie.quantity_sold && <span className="form-error">{ie.quantity_sold}</span>}
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Unit Price</label>
                  <input type="number" min={0} step="0.01" value={item.unit_price}
                    onChange={e => updateItem(idx, "unit_price", e.target.value)}
                    className={ie.unit_price ? "error" : ""} />
                  {ie.unit_price && <span className="form-error">{ie.unit_price}</span>}
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Discount %</label>
                  <input type="number" min={0} max={100} value={item.discount_pct}
                    onChange={e => updateItem(idx, "discount_pct", e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Subtotal</label>
                  <input readOnly value={`Rs. ${sub.toFixed(2)}`} />
                </div>
                <button className="remove-btn" onClick={() => removeItem(idx)} disabled={items.length === 1}>×</button>
              </div>
            </div>
          );
        })}

        <div className="total-bar">
          <span className="label">Grand Total</span>
          <span className="amount">Rs. {total.toFixed(2)}</span>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={() => navigate("/sales")}>Cancel</button>
          <button className="btn btn-success" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Processing…" : "✓ Confirm Sale"}
          </button>
        </div>
      </div>
    </div>
  );
}
