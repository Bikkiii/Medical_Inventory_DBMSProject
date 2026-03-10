function Sidebar({ activePage, setActivePage, currentUser }) {
  const links = [
    { id: "dashboard", label: "Dashboard", icon: "▦" },
    { id: "stock", label: "Stock", icon: "◫" },
    { id: "batches", label: "Batches", icon: "⊞" },
    { id: "sales", label: "Sales", icon: "◈" },
    { id: "returns", label: "Returns", icon: "↩" },
    { id: "ledger", label: "Ledger", icon: "≡" },
    { id: "alerts", label: "Alerts", icon: "⚠" },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">💊</div>
          <h2>MedStore IMS</h2>
        </div>
        <p>Medical Inventory System</p>
      </div>

      <nav>
        <div className="nav-section-label">Main Menu</div>
        {links.map((link) => (
          <button
            key={link.id}
            className={`nav-link ${activePage === link.id ? "active" : ""}`}
            onClick={() => setActivePage(link.id)}
          >
            <span className="nav-icon">{link.icon}</span>
            {link.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-name">{currentUser.full_name}</div>
        <div className="user-role">{currentUser.role}</div>
      </div>
    </div>
  );
}

export default Sidebar;
