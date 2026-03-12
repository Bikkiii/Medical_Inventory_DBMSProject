import { useState, useEffect } from "react";
import { apiFetch, apiPost, apiPut, apiPatch } from "../api";
import { useToast } from "../hooks/useToast";
import ConfirmDialog from "../components/ConfirmDialog";

const EMPTY = { supplier_name:"", phone:"", email:"", address:"" };
const PHONE_INPUT = /^\d*$/;
const sanitizePhoneInput = (val) => (val === "" || PHONE_INPUT.test(val) ? val : null);

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState("all");
  const [search,    setSearch]    = useState("");
  const [showForm,  setShowForm]  = useState(false);
  const [editItem,  setEditItem]  = useState(null);
  const [confirm,   setConfirm]   = useState(null);
  const showToast = useToast();

  useEffect(() => {
    apiFetch("/suppliers/all")
      .then(setSuppliers)
      .catch(() => setSuppliers([]))
      .finally(() => setLoading(false));
  }, []);

  function reload() {
    setLoading(true);
    apiFetch("/suppliers/all")
      .then(setSuppliers)
      .catch(() => setSuppliers([]))
      .finally(() => setLoading(false));
  }

  const displayed = suppliers.filter(s => {
    if (tab === "active"   && !s.is_active) return false;
    if (tab === "inactive" &&  s.is_active) return false;
    if (search && !s.supplier_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function handleDeactivate(s) {
    setConfirm({
      message: `Deactivate "${s.supplier_name}"? This supplier will be hidden from new batch creation. All historical batches will remain intact.`,
      onConfirm: async () => {
        try {
          await apiPatch(`/suppliers/${s.supplier_id}/deactivate`);
          showToast("Supplier deactivated.", "success");
          reload();
        } catch (err) { showToast(err.message, "error"); }
        setConfirm(null);
      }
    });
  }

  async function handleReactivate(s) {
    try {
      await apiPatch(`/suppliers/${s.supplier_id}/reactivate`);
      showToast("Supplier reactivated.", "success");
      reload();
    } catch (err) { showToast(err.message, "error"); }
  }

  return (
    <div>
      <div className="page-header">
        <div><h1>Suppliers</h1><p>Manage medicine suppliers</p></div>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditItem(null); setShowForm(true); }}>+ Add Supplier</button>
      </div>

      <div className="filter-bar">
        <div className="search-wrapper">
          <input className="search-bar" placeholder="Search supplier…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="tabs">
        {["all","active","inactive"].map(t => (
          <button key={t} className={`tab-btn${tab===t?" active":""}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      {loading ? <div className="loading">Loading…</div> : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Name</th><th>Phone</th><th>Email</th><th>Address</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {displayed.length === 0 ? (
                  <tr><td colSpan={6} className="empty-state">No suppliers found.</td></tr>
                ) : displayed.map(s => (
                  <tr key={s.supplier_id}>
                    <td style={{ fontWeight: 600 }}>{s.supplier_name}</td>
                    <td>{s.phone}</td>
                    <td className="td-muted">{s.email || "—"}</td>
                    <td className="td-muted" style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.address || "—"}</td>
                    <td>
                      {s.is_active
                        ? <span className="badge badge-green">Active</span>
                        : <span className="badge badge-gray">Inactive</span>}
                    </td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-secondary btn-xs" onClick={() => { setEditItem(s); setShowForm(true); }}>Edit</button>
                      {s.is_active
                        ? <button className="btn btn-danger btn-xs" onClick={() => handleDeactivate(s)}>Deactivate</button>
                        : <button className="btn btn-success btn-xs" onClick={() => handleReactivate(s)}>Reactivate</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <SupplierFormModal
          initial={editItem}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); reload(); }}
        />
      )}

      {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

function SupplierFormModal({ initial, onClose, onSaved }) {
  const [form, setForm]       = useState(initial ? { supplier_name: initial.supplier_name, phone: initial.phone, email: initial.email||"", address: initial.address||"" } : { ...EMPTY });
  const [loading, setLoading] = useState(false);
  const showToast = useToast();

  async function handleSave() {
    if (!form.supplier_name || !form.phone) { showToast("Name and phone are required", "error"); return; }
    setLoading(true);
    try {
      if (initial) {
        await apiPut(`/suppliers/${initial.supplier_id}`, form);
        showToast("Supplier updated.", "success");
      } else {
        await apiPost("/suppliers", form);
        showToast("Supplier added.", "success");
      }
      onSaved();
    } catch (err) { showToast(err.message, "error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3>{initial ? "Edit Supplier" : "Add Supplier"}</h3>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Supplier Name *</label>
              <input value={form.supplier_name} onChange={e => setForm(f=>({...f,supplier_name:e.target.value}))} placeholder="e.g. Himalayan Pharma" />
            </div>
            <div className="form-group">
              <label>Phone *</label>
              <input
                value={form.phone}
                inputMode="numeric"
                onChange={e => {
                  const next = sanitizePhoneInput(e.target.value);
                  if (next === null) return;
                  setForm(f => ({ ...f, phone: next }));
                }}
                placeholder="98XXXXXXXX"
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} placeholder="supplier@email.com" />
            </div>
            <div className="form-group full-width">
              <label>Address</label>
              <textarea value={form.address} onChange={e => setForm(f=>({...f,address:e.target.value}))} placeholder="Full address…" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={loading}>
            {loading ? "Saving…" : initial ? "Update" : "Add Supplier"}
          </button>
        </div>
      </div>
    </div>
  );
}
