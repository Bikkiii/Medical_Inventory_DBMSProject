import { useState, useEffect } from "react";
import { apiFetch, apiPost } from "../api";
import { useToast } from "../hooks/useToast";
import { useAuth } from "../hooks/useAuth";

const returnTypeBadge = {
  customer_return:  "badge-blue",
  damage_report:    "badge-orange",
  supplier_return:  "badge-purple",
};
const resolutionBadge = {
  refund:             "badge-green",
  replacement:        "badge-teal",
  write_off:          "badge-red",
  return_to_supplier: "badge-purple",
  pending:            "badge-gray",
};

const INT_INPUT = /^\d*$/;
const sanitizeIntInput = (val) => (val === "" || INT_INPUT.test(val) ? val : null);

const groupStockRows = (rows) => {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = `${row.medicine_id}:${row.batch_no}:${row.expiry_date}:${row.unit_price}`;
    const existing = grouped.get(key);
    const batchItem = {
      batch_item_id: row.batch_item_id,
      current_stock: row.current_stock,
      expiry_date: row.expiry_date,
    };
    if (!existing) {
      grouped.set(key, {
        ...row,
        group_key: key,
        batch_item_ids: [row.batch_item_id],
        batch_items: [batchItem],
        current_stock: row.current_stock,
      });
      return;
    }
    existing.batch_item_ids.push(row.batch_item_id);
    existing.batch_items.push(batchItem);
    existing.current_stock += row.current_stock;
  });

  return Array.from(grouped.values()).map((row) => ({
    ...row,
    batch_items: row.batch_items.sort(
      (a, b) => new Date(a.expiry_date) - new Date(b.expiry_date) || a.batch_item_id - b.batch_item_id,
    ),
  }));
};

// ──────────────────────────────────────────
//  Returns List Page
// ──────────────────────────────────────────
export function ReturnsListPage() {
  const [returns, setReturns]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [resFilter, setResFilter]   = useState("all");

  useEffect(() => {
    apiFetch("/returns")
      .then(setReturns)
      .catch(() => setReturns([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = returns.filter(r => {
    if (typeFilter !== "all" && r.return_type  !== typeFilter) return false;
    if (resFilter  !== "all" && r.resolution   !== resFilter)  return false;
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div><h1>Returns</h1><p>All customer returns and damage reports</p></div>
      </div>

      <div className="filter-bar">
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          <option value="customer_return">Customer Return</option>
          <option value="damage_report">Damage Report</option>
          <option value="supplier_return">Supplier Return</option>
        </select>
        <select value={resFilter} onChange={e => setResFilter(e.target.value)}>
          <option value="all">All Resolutions</option>
          <option value="refund">Refund</option>
          <option value="replacement">Replacement</option>
          <option value="write_off">Write-Off</option>
          <option value="return_to_supplier">Return to Supplier</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {loading ? <div className="loading">Loading…</div> : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Type</th><th>Medicine</th><th>Batch</th>
                  <th>Qty</th><th>Reason</th><th>Resolution</th>
                  <th>Refund</th><th>Customer</th><th>Processed By</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={11} className="empty-state">No returns found.</td></tr>
                ) : filtered.map(r => (
                  <tr key={r.return_id}>
                    <td className="td-primary">{r.return_id}</td>
                    <td><span className={`badge ${returnTypeBadge[r.return_type] || "badge-gray"}`}>{r.return_type.replace(/_/g," ")}</span></td>
                    <td><div style={{ fontWeight: 600 }}>{r.medicine_name}</div><div className="td-muted">{r.brand_name}</div></td>
                    <td className="td-primary">{r.batch_no}</td>
                    <td>{r.quantity_returned}</td>
                    <td className="td-muted">{r.reason}</td>
                    <td><span className={`badge ${resolutionBadge[r.resolution] || "badge-gray"}`}>{r.resolution.replace(/_/g," ")}</span></td>
                    <td>{r.refund_amount ? `Rs. ${parseFloat(r.refund_amount).toFixed(2)}` : "—"}</td>
                    <td className="td-muted">{r.customer_name || "—"}</td>
                    <td className="td-muted">{r.processed_by_name}</td>
                    <td className="td-muted">{new Date(r.return_date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
//  Customer Return Page
// ──────────────────────────────────────────
export function CustomerReturnPage() {
  const [saleId,      setSaleId]      = useState("");
  const [saleData,    setSaleData]    = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [form,        setForm]        = useState({ quantity_returned: 1, reason: "", resolution: "refund" });
  const [loading,     setLoading]     = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState("");

  const showToast = useToast();
  const { user }  = useAuth();

  async function searchSale() {
    if (!saleId) return;
    setLoading(true);
    setError("");
    setSaleData(null);
    setSelectedItem(null);
    try {
      const data = await apiFetch(`/sales/${saleId}`);
      setSaleData(data);
    } catch (err) {
      setError(err.status === 404 ? "Sale not found. Check the Sale ID." : err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!selectedItem) { showToast("Select an item to return", "error"); return; }
    if (!form.reason)   { showToast("Reason is required", "error"); return; }
    if (form.quantity_returned <= 0) { showToast("Quantity must be > 0", "error"); return; }
    const maxReturnable = selectedItem.returnable_qty ?? selectedItem.quantity_sold;
    if (form.quantity_returned > maxReturnable) {
      showToast(`Cannot exceed remaining quantity (${maxReturnable})`, "error"); return;
    }

    setSubmitting(true);
    try {
      const payload = {
        quantity_returned: parseInt(form.quantity_returned),
        reason:            form.reason,
        resolution:        form.resolution,
        processed_by:      user.user_id,
      };

      if (Array.isArray(selectedItem.sale_item_ids) && selectedItem.sale_item_ids.length > 0) {
        payload.sale_item_ids = selectedItem.sale_item_ids;
      } else {
        payload.sale_item_id = selectedItem.sale_item_id;
      }

      await apiPost("/returns/customer", payload);
      showToast("Return processed successfully!", "success");
      setSaleData(null);
      setSaleId("");
      setSelectedItem(null);
      setForm({ quantity_returned: 1, reason: "", resolution: "refund" });
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div><h1>Customer Return</h1><p>Process a medicine return from a customer</p></div>
      </div>

      {/* Step 1: Find sale */}
      <div className="card">
        <div className="section-title">Step 1 — Find Original Sale</div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--border-dark)", borderRadius: "var(--radius-sm)", fontFamily: "DM Sans, sans-serif", fontSize: 13 }}
            placeholder="Enter Sale ID (e.g. 12)"
            value={saleId}
            onChange={e => {
              const next = sanitizeIntInput(e.target.value);
              if (next === null) return;
              setSaleId(next);
            }}
            onKeyDown={e => e.key === "Enter" && searchSale()}
            type="number"
          />
          <button className="btn btn-primary btn-sm" onClick={searchSale} disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
        {error && <div className="alert alert-danger" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {/* Step 2: Show sale & pick item */}
      {saleData && (
        <div className="card">
          <div className="section-title">Step 2 — Select Item to Return</div>

          {saleData.sale_status === "fully_returned" && (
            <div className="alert alert-warning">This sale has already been fully returned.</div>
          )}
          {saleData.sale_status === "partially_returned" && (
            <div className="alert alert-info">This sale has been partially returned.</div>
          )}

          <div style={{ marginBottom: 14, fontSize: 13 }}>
            <strong>{saleData.customer_name}</strong>
            {saleData.customer_phone && ` · ${saleData.customer_phone}`}
            <span className="td-muted" style={{ marginLeft: 8 }}>Sale #{saleData.sale_id} · {new Date(saleData.sale_date).toLocaleDateString()}</span>
          </div>

          <div className="table-wrapper">
            <table>
              <thead><tr><th></th><th>Medicine</th><th>Batch</th><th>Qty Remaining</th><th>Unit Price</th></tr></thead>
              <tbody>
                {(() => {
                  const groups = new Map();
                    (saleData.items || []).forEach((it) => {
                      const key = `${it.batch_item_id}:${it.medicine_id}:${it.unit_price}:${it.discount_pct || 0}`;
                      const soldQty = Number(it.quantity_sold) || 0;
                      const returnedQty = Number(it.returned_qty) || 0;
                      const existing = groups.get(key);
                      if (!existing) {
                        groups.set(key, {
                          key,
                          sale_item_ids: [it.sale_item_id],
                          sale_item_id: it.sale_item_id, // fallback
                          batch_item_id: it.batch_item_id,
                          medicine_id: it.medicine_id,
                          medicine_name: it.medicine_name,
                          brand_name: it.brand_name,
                          batch_no: it.batch_no,
                          quantity_sold: soldQty,
                          returned_qty: returnedQty,
                          unit_price: it.unit_price,
                          discount_pct: it.discount_pct || 0,
                        });
                        return;
                      }
                      existing.sale_item_ids.push(it.sale_item_id);
                      existing.quantity_sold += soldQty;
                      existing.returned_qty += returnedQty;
                    });
                    return Array.from(groups.values()).map((g) => ({
                      ...g,
                      returnable_qty: Math.max((g.quantity_sold || 0) - (g.returned_qty || 0), 0),
                    }));
                })().map(it => {
                  const isSelectable = it.returnable_qty > 0;
                  return (
                    <tr key={it.key}
                      style={{
                        cursor: isSelectable ? "pointer" : "not-allowed",
                        opacity: isSelectable ? 1 : 0.5,
                        background: selectedItem?.key === it.key ? "var(--teal-light)" : "",
                      }}
                      onClick={() => {
                        if (!isSelectable) return;
                        setSelectedItem(it);
                        setForm(f => ({ ...f, quantity_returned: Math.min(1, it.returnable_qty || 1) }));
                      }}>
                      <td>
                        <input type="radio" readOnly checked={selectedItem?.key === it.key} disabled={!isSelectable} />
                      </td>
                      <td><div style={{ fontWeight: 600 }}>{it.medicine_name}</div><div className="td-muted">{it.brand_name}</div></td>
                      <td className="td-primary">{it.batch_no}</td>
                      <td>
                        {it.returnable_qty}
                        <div className="td-muted">Sold: {it.quantity_sold}</div>
                        {it.returned_qty > 0 && <div className="td-muted">Returned: {it.returned_qty}</div>}
                      </td>
                      <td>Rs. {parseFloat(it.unit_price).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Step 3: Return form */}
      {selectedItem && (
        <div className="card">
          <div className="section-title">Step 3 — Return Details</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Quantity to Return (Max {selectedItem.returnable_qty ?? selectedItem.quantity_sold})</label>
              <input type="number" min={1} max={selectedItem.returnable_qty ?? selectedItem.quantity_sold}
                value={form.quantity_returned}
                onChange={e => {
                  const next = sanitizeIntInput(e.target.value);
                  if (next === null) return;
                  setForm(f => ({ ...f, quantity_returned: next }));
                }} />
            </div>
            <div className="form-group">
              <label>Resolution *</label>
              <select value={form.resolution} onChange={e => setForm(f => ({ ...f, resolution: e.target.value }))}>
                <option value="refund">Refund — stock goes back, customer gets money</option>
                <option value="replacement">Replacement — stock goes back, new sale separately</option>
                <option value="pending">Pending — no stock change yet</option>
              </select>
            </div>
            <div className="form-group full-width">
              <label>Reason *</label>
              <select value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}>
                <option value="">Select reason…</option>
                <option value="wrong_medicine">Wrong Medicine</option>
                <option value="damaged">Damaged</option>
                <option value="expired">Expired</option>
                <option value="side_effect">Side Effect</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={() => setSelectedItem(null)}>Cancel</button>
            <button className="btn btn-warning" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Processing…" : "↩ Process Return"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
//  Damage Report Page
// ──────────────────────────────────────────
export function DamageReportPage() {
  const [stock,      setStock]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [form, setForm] = useState({
    group_key: "", batch_item_id: "", quantity_damaged: "", damage_cause: "", resolution: "write_off"
  });
  const [maxQty, setMaxQty] = useState(0);
  const [errors, setErrors] = useState({});

  const showToast = useToast();
  const { user }  = useAuth();

  useEffect(() => {
    apiFetch("/inventory/current-stock")
      .then(data => setStock(groupStockRows(data.filter(r => r.current_stock > 0))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function pickItem(val) {
    const row = stock.find(r => String(r.group_key) === String(val));
    setSelectedGroup(row || null);
    setForm(f => ({ ...f, group_key: val, batch_item_id: row?.batch_item_ids?.[0] || "" }));
    setMaxQty(row?.current_stock || 0);
  }

  function validate() {
    const e = {};
    if (!form.group_key)                             e.batch_item_id     = "Select a batch item";
    if (!form.quantity_damaged || form.quantity_damaged <= 0) e.quantity_damaged = "Must be > 0";
    if (form.quantity_damaged > maxQty)              e.quantity_damaged  = `Cannot exceed stock (${maxQty})`;
    if (!form.damage_cause)                          e.damage_cause      = "Damage cause is required";
    return e;
  }

  async function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      const payload = {
        quantity_damaged: parseInt(form.quantity_damaged),
        damage_cause:     form.damage_cause,
        resolution:       form.resolution,
        processed_by:     user.user_id,
      };

      if (selectedGroup?.batch_item_ids?.length > 1) {
        payload.batch_item_ids = selectedGroup.batch_item_ids;
      } else {
        payload.batch_item_id = parseInt(form.batch_item_id);
      }

      await apiPost("/returns/damage", payload);
      showToast("Damage report submitted. Stock updated.", "success");
      setForm({ group_key: "", batch_item_id: "", quantity_damaged: "", damage_cause: "", resolution: "write_off" });
      setSelectedGroup(null);
      setMaxQty(0);
      setErrors({});
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
        <div><h1>Damage Report</h1><p>Report damaged stock before it reaches customers</p></div>
      </div>

      <div className="card" style={{ maxWidth: 640 }}>
        <div className="section-title">Report Damage / Write-Off</div>

        <div className="form-grid">
          <div className="form-group full-width">
            <label>Batch Item (Medicine + Batch) *</label>
            <select value={form.group_key} onChange={e => pickItem(e.target.value)}
              className={errors.batch_item_id ? "error" : ""}>
              <option value="">Select medicine & batch…</option>
              {stock.map(r => (
                <option key={r.group_key} value={r.group_key}>
                  {r.medicine_name} | Batch: {r.batch_no} | Exp: {new Date(r.expiry_date).toLocaleDateString()} | Stock: {r.current_stock}{r.batch_item_ids?.length > 1 ? " (merged)" : ""}
                </option>
              ))}
            </select>
            {errors.batch_item_id && <span className="form-error">{errors.batch_item_id}</span>}
          </div>

          <div className="form-group">
            <label>Quantity Damaged {maxQty > 0 && `(Max ${maxQty})`} *</label>
            <input type="number" min={1} max={maxQty}
              value={form.quantity_damaged}
              onChange={e => {
                const next = sanitizeIntInput(e.target.value);
                if (next === null) return;
                setForm(f => ({ ...f, quantity_damaged: next }));
              }}
              className={errors.quantity_damaged ? "error" : ""} />
            {errors.quantity_damaged && <span className="form-error">{errors.quantity_damaged}</span>}
          </div>

          <div className="form-group">
            <label>Damage Cause *</label>
            <select value={form.damage_cause}
              onChange={e => setForm(f => ({ ...f, damage_cause: e.target.value }))}
              className={errors.damage_cause ? "error" : ""}>
              <option value="">Select cause…</option>
              <option value="transit">Transit</option>
              <option value="storage">Storage</option>
              <option value="expiry">Expiry</option>
              <option value="handling">Handling</option>
              <option value="other">Other</option>
            </select>
            {errors.damage_cause && <span className="form-error">{errors.damage_cause}</span>}
          </div>

          <div className="form-group full-width">
            <label>Resolution *</label>
            <select value={form.resolution} onChange={e => setForm(f => ({ ...f, resolution: e.target.value }))}>
              <option value="write_off">Write Off — permanently remove from stock</option>
              <option value="return_to_supplier">Return to Supplier — send back</option>
            </select>
          </div>
        </div>

        {maxQty > 0 && form.quantity_damaged > 0 && (
          <div className="alert alert-warning" style={{ marginTop: 12 }}>
            ⚠ This will deduct <strong>{form.quantity_damaged}</strong> units from batch stock.
            Remaining: <strong>{maxQty - parseInt(form.quantity_damaged || 0)}</strong> units.
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setForm({
                group_key: "",
                batch_item_id: "",
                quantity_damaged: "",
                damage_cause: "",
                resolution: "write_off",
              });
              setSelectedGroup(null);
              setMaxQty(0);
              setErrors({});
            }}
          >
            Reset
          </button>
          <button className="btn btn-danger" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting…" : "⚠ Submit Damage Report"}
          </button>
        </div>
      </div>
    </div>
  );
}
