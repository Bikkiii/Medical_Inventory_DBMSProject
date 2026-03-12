import { useState, useEffect } from "react";
import { apiFetch, apiPost, apiPatch } from "../api";
import { useToast } from "../hooks/useToast";
import { useAuth } from "../hooks/useAuth";
import ConfirmDialog from "../components/ConfirmDialog";

export default function UsersPage() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState("all");
  const [search,  setSearch]  = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [viewUser, setViewUser] = useState(null);
  const showToast = useToast();
  const { user: me } = useAuth();

  useEffect(() => {
    apiFetch("/auth/users")
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  function reload() {
    setLoading(true);
    apiFetch("/auth/users")
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }

  const displayed = users.filter(u => {
    if (tab === "active"      &&  !u.is_active) return false;
    if (tab === "deactivated" &&   u.is_active) return false;
    if (search && !u.full_name.toLowerCase().includes(search.toLowerCase()) &&
                  !u.username.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function handleDeactivate(u) {
    if (u.user_id === me.user_id) { showToast("Cannot deactivate your own account", "error"); return; }
    setConfirm({
      message: `Deactivate user "${u.full_name}" (@${u.username})? They will not be able to log in.`,
      onConfirm: async () => {
        try {
          await apiPatch(`/auth/users/${u.user_id}/deactivate`);
          showToast("User deactivated.", "success");
          reload();
        } catch (err) { showToast(err.message, "error"); }
        setConfirm(null);
      }
    });
  }

  async function handleReactivate(u) {
    try {
      await apiPatch(`/auth/users/${u.user_id}/reactivate`);
      showToast("User reactivated.", "success");
      reload();
    } catch (err) { showToast(err.message, "error"); }
  }

  return (
    <div>
      <div className="page-header">
        <div><h1>Users</h1><p>Manage system accounts</p></div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add User</button>
      </div>

      <div className="filter-bar">
        <div className="search-wrapper">
          <input className="search-bar" placeholder="Search name or username…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="tabs">
        {["all","active","deactivated"].map(t => (
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
                <tr><th>Full Name</th><th>Username</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {displayed.length === 0 ? (
                  <tr><td colSpan={6} className="empty-state">No users found.</td></tr>
                ) : displayed.map(u => (
                  <tr key={u.user_id}>
                    <td style={{ fontWeight: 600 }}>{u.full_name} {u.user_id === me.user_id && <span className="badge badge-teal" style={{ fontSize: 9 }}>You</span>}</td>
                    <td className="td-primary">@{u.username}</td>
                    <td><span className={`badge ${u.role === "admin" ? "badge-purple" : "badge-blue"}`}>{u.role}</span></td>
                    <td>{u.is_active ? <span className="badge badge-green">Active</span> : <span className="badge badge-gray">Deactivated</span>}</td>
                    <td className="td-muted">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-secondary btn-xs" onClick={() => setViewUser(u)}>View</button>
                      {u.user_id !== me.user_id && (
                        u.is_active
                          ? <button className="btn btn-danger btn-xs" onClick={() => handleDeactivate(u)}>Deactivate</button>
                          : <button className="btn btn-success btn-xs" onClick={() => handleReactivate(u)}>Reactivate</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); reload(); }} />}
      {confirm  && <ConfirmDialog message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
      {viewUser && <UserInfoModal user={viewUser} onClose={() => setViewUser(null)} />}
    </div>
  );
}

function UserInfoModal({ user, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3>User Info</h3>
        <div className="modal-body">
          <div className="form-grid">
            <div><span className="td-muted">Full Name</span><br /><strong>{user.full_name}</strong></div>
            <div><span className="td-muted">Username</span><br /><strong>@{user.username}</strong></div>
            <div><span className="td-muted">Role</span><br /><span className={`badge ${user.role === "admin" ? "badge-purple" : "badge-blue"}`}>{user.role}</span></div>
            <div><span className="td-muted">Status</span><br />{user.is_active ? <span className="badge badge-green">Active</span> : <span className="badge badge-gray">Deactivated</span>}</div>
            <div><span className="td-muted">User ID</span><br /><strong>{user.user_id}</strong></div>
            <div><span className="td-muted">Created</span><br /><strong>{new Date(user.created_at).toLocaleString()}</strong></div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function AddUserModal({ onClose, onSaved }) {
  const [form, setForm]       = useState({ full_name:"", username:"", password:"", role:"pharmacist" });
  const [loading, setLoading] = useState(false);
  const showToast = useToast();

  async function handleSave() {
    if (!form.full_name || !form.username || !form.password) { showToast("All fields required", "error"); return; }
    if (form.password.length < 6) { showToast("Password must be at least 6 characters", "error"); return; }
    setLoading(true);
    try {
      await apiPost("/auth/register", form);
      showToast("User created successfully.", "success");
      onSaved();
    } catch (err) { showToast(err.message, "error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3>Add New User</h3>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Full Name *</label>
              <input value={form.full_name} onChange={e => setForm(f=>({...f,full_name:e.target.value}))} placeholder="e.g. Ram Sharma" />
            </div>
            <div className="form-group">
              <label>Username *</label>
              <input value={form.username} onChange={e => setForm(f=>({...f,username:e.target.value}))} placeholder="e.g. ramsharma" />
            </div>
            <div className="form-group">
              <label>Role *</label>
              <select value={form.role} onChange={e => setForm(f=>({...f,role:e.target.value}))}>
                <option value="pharmacist">Pharmacist</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="form-group full-width">
              <label>Password * (min 6 characters)</label>
              <input type="password" value={form.password} onChange={e => setForm(f=>({...f,password:e.target.value}))} placeholder="••••••" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={loading}>
            {loading ? "Creating…" : "Create User"}
          </button>
        </div>
      </div>
    </div>
  );
}
