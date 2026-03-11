const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "⊞" },
  { id: "stock", label: "Stock", icon: "◫" },
  { id: "batches", label: "Batches", icon: "⊟" },
  { id: "sales", label: "Sales", icon: "⊕" },
  { id: "returns", label: "Returns", icon: "↩" },
  { id: "ledger", label: "Ledger", icon: "≡" },
  { id: "alerts", label: "Alerts", icon: "⚠" },
];

function Sidebar({ activePage, setActivePage, currentUser }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">💊</div>
          <h2>MedStore IMS</h2>
        </div>
        <p>Inventory Management</p>
      </div>

      <nav>
        <div className="nav-section-label">Navigation</div>
        {NAV.map((n) => (
          <button
            key={n.id}
            className={`nav-link ${activePage === n.id ? "active" : ""}`}
            onClick={() => setActivePage(n.id)}
          >
            <span className="nav-icon">{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-name">
          {currentUser?.full_name || "Admin User"}
        </div>
        <div className="user-role">{currentUser?.role || "admin"}</div>
      </div>
    </aside>
  );
}

export default Sidebar;
