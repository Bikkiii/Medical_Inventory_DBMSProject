import { useState, useEffect } from "react";
import { apiFetch, apiPost, apiPut, apiPatch } from "../api";
import { useToast } from "../hooks/useToast";
import ConfirmDialog from "../components/ConfirmDialog";

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const showToast = useToast();

  useEffect(() => {
    apiFetch("/categories/all")
      .then(setCategories)
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, []);

  function reload() {
    setLoading(true);
    apiFetch("/categories/all")
      .then(setCategories)
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }

  const displayed = categories.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()),
  );

  function handleDeactivate(c) {
    setConfirm({
      message: `Deactivate category "${c.name}"? Medicines under this category will remain unchanged.`,
      onConfirm: async () => {
        try {
          await apiPatch(`/categories/${c.category_id}/deactivate`);
          showToast("Category deactivated.", "success");
          reload();
        } catch (err) { showToast(err.message, "error"); }
        setConfirm(null);
      },
    });
  }

  async function handleReactivate(c) {
    try {
      await apiPatch(`/categories/${c.category_id}/reactivate`);
      showToast("Category reactivated.", "success");
      reload();
    } catch (err) { showToast(err.message, "error"); }
  }

  return (
    <div>
      <div className="page-header">
        <div><h1>Categories</h1><p>Manage medicine categories</p></div>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditItem(null); setShowForm(true); }}>+ Add Category</button>
      </div>

      <div className="filter-bar">
        <div className="search-wrapper">
          <input className="search-bar" placeholder="Search category..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? <div className="loading">Loading...</div> : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Name</th><th>Description</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {displayed.length === 0 ? (
                  <tr><td colSpan={4} className="empty-state">No categories found.</td></tr>
                ) : displayed.map(c => (
                  <tr key={c.category_id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td className="td-muted">{c.description || "-"}</td>
                    <td>{c.is_active ? <span className="badge badge-green">Active</span> : <span className="badge badge-gray">Inactive</span>}</td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-secondary btn-xs" onClick={() => { setEditItem(c); setShowForm(true); }}>Edit</button>
                      {c.is_active
                        ? <button className="btn btn-danger btn-xs" onClick={() => handleDeactivate(c)}>Deactivate</button>
                        : <button className="btn btn-success btn-xs" onClick={() => handleReactivate(c)}>Reactivate</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <CategoryFormModal
          initial={editItem}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); reload(); }}
        />
      )}

      {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

function CategoryFormModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial ? { name: initial.name, description: initial.description || "" } : { name: "", description: "" });
  const [loading, setLoading] = useState(false);
  const showToast = useToast();

  async function handleSave() {
    if (!form.name) { showToast("Name is required", "error"); return; }
    setLoading(true);
    try {
      if (initial) {
        await apiPut(`/categories/${initial.category_id}`, form);
        showToast("Category updated.", "success");
      } else {
        await apiPost("/categories", form);
        showToast("Category added.", "success");
      }
      onSaved();
    } catch (err) { showToast(err.message, "error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3>{initial ? "Edit Category" : "Add Category"}</h3>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Antibiotic" />
            </div>
            <div className="form-group full-width">
              <label>Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : initial ? "Update" : "Add Category"}
          </button>
        </div>
      </div>
    </div>
  );
}

