import { useState, useEffect } from "react";
import { apiFetch, apiPost, apiPut, apiPatch } from "../api";
import { useToast } from "../hooks/useToast";
import ConfirmDialog from "../components/ConfirmDialog";

const CATEGORIES = ["antibiotic","analgesic","antiviral","vitamin","vaccine","topical","other"];
const EMPTY_FORM = { medicine_name:"", brand_name:"", category:"other", strength:"", reorder_level:0 };

export default function MedicinesPage() {
  const [medicines, setMedicines] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState("all");
  const [search,    setSearch]    = useState("");
  const [showForm,  setShowForm]  = useState(false);
  const [editItem,  setEditItem]  = useState(null);
  const [confirm,   setConfirm]   = useState(null);
  const showToast = useToast();

  useEffect(() => {
    apiFetch("/medicines/all")
      .then(setMedicines)
      .catch(() => setMedicines([]))
      .finally(() => setLoading(false));
  }, []);

  function reload() {
    setLoading(true);
    apiFetch("/medicines/all")
      .then(setMedicines)
      .catch(() => setMedicines([]))
      .finally(() => setLoading(false));
  }

  const displayed = medicines.filter(m => {
    if (tab === "active"   && !m.is_active) return false;
    if (tab === "inactive" &&  m.is_active) return false;
    if (search && !m.medicine_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function handleDeactivate(m) {
    setConfirm({
      message: `Deactivate "${m.medicine_name}"? It will no longer be available for sale. All historical records are preserved.`,
      onConfirm: async () => {
        try {
          await apiPatch(`/medicines/${m.medicine_id}/deactivate`);
          showToast("Medicine deactivated.", "success");
          reload();
        } catch (err) { showToast(err.message, "error"); }
        setConfirm(null);
      }
    });
  }

  async function handleReactivate(m) {
    try {
      await apiPatch(`/medicines/${m.medicine_id}/reactivate`);
      showToast("Medicine reactivated.", "success");
      reload();
    } catch (err) { showToast(err.message, "error"); }
  }

  return (
    <div>
      <div className="page-header">
        <div><h1>Medicines</h1><p>Manage medicine catalogue</p></div>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditItem(null); setShowForm(true); }}>+ Add Medicine</button>
      </div>

      <div className="filter-bar">
        <div className="search-wrapper">
          <input className="search-bar" placeholder="Search medicine…" value={search} onChange={e => setSearch(e.target.value)} />
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
                <tr><th>Name</th><th>Brand</th><th>Category</th><th>Strength</th><th>Reorder</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {displayed.length === 0 ? (
                  <tr><td colSpan={7} className="empty-state">No medicines found.</td></tr>
                ) : displayed.map(m => (
                  <tr key={m.medicine_id}>
                    <td style={{ fontWeight: 600 }}>{m.medicine_name}</td>
                    <td className="td-muted">{m.brand_name || "—"}</td>
                    <td><span className="badge badge-blue">{m.category}</span></td>
                    <td className="td-muted">{m.strength || "—"}</td>
                    <td>{m.reorder_level}</td>
                    <td>
                      {m.is_active
                        ? <span className="badge badge-green">Active</span>
                        : <span className="badge badge-gray">Discontinued</span>}
                    </td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-secondary btn-xs" onClick={() => { setEditItem(m); setShowForm(true); }}>Edit</button>
                      {m.is_active
                        ? <button className="btn btn-danger btn-xs" onClick={() => handleDeactivate(m)}>Deactivate</button>
                        : <button className="btn btn-success btn-xs" onClick={() => handleReactivate(m)}>Reactivate</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <MedicineFormModal
          initial={editItem}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); reload(); }}
        />
      )}

      {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

function MedicineFormModal({ initial, onClose, onSaved }) {
  const [form, setForm]       = useState(initial ? { ...initial } : { ...EMPTY_FORM });
  const [loading, setLoading] = useState(false);
  const showToast = useToast();

  async function handleSave() {
    if (!form.medicine_name || !form.category) { showToast("Name and category are required", "error"); return; }
    setLoading(true);
    try {
      if (initial) {
        await apiPut(`/medicines/${initial.medicine_id}`, form);
        showToast("Medicine updated.", "success");
      } else {
        await apiPost("/medicines", form);
        showToast("Medicine added.", "success");
      }
      onSaved();
    } catch (err) { showToast(err.message, "error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3>{initial ? "Edit Medicine" : "Add Medicine"}</h3>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Medicine Name *</label>
              <input value={form.medicine_name} onChange={e => setForm(f => ({...f, medicine_name: e.target.value}))} placeholder="e.g. Amoxicillin" />
            </div>
            <div className="form-group">
              <label>Brand Name</label>
              <input value={form.brand_name || ""} onChange={e => setForm(f => ({...f, brand_name: e.target.value}))} placeholder="e.g. Moxikind" />
            </div>
            <div className="form-group">
              <label>Category *</label>
              <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Strength</label>
              <input value={form.strength || ""} onChange={e => setForm(f => ({...f, strength: e.target.value}))} placeholder="e.g. 500mg" />
            </div>
            <div className="form-group">
              <label>Reorder Level</label>
              <input type="number" min={0} value={form.reorder_level} onChange={e => setForm(f => ({...f, reorder_level: parseInt(e.target.value)||0}))} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={loading}>
            {loading ? "Saving…" : initial ? "Update" : "Add Medicine"}
          </button>
        </div>
      </div>
    </div>
  );
}
