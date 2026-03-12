import { NavLink } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
    >
      <span className="nav-icon">{icon}</span>
      {label}
    </NavLink>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuth();

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
        <div className="nav-section-label">Main</div>
        <NavItem to="/"       icon="⊞" label="Dashboard" />
        <NavItem to="/stock"  icon="◫" label="Stock" />
        <NavItem to="/batches" icon="⊟" label="Batches" />
        <NavItem to="/sales"  icon="⊕" label="Sales" />

        <div className="nav-section-label">Returns</div>
        <NavItem to="/returns/customer" icon="↩" label="Customer Return" />
        <NavItem to="/returns/damage"   icon="⚠" label="Damage Report" />
        <NavItem to="/returns"          icon="≡" label="Returns List" />

        <div className="nav-section-label">Audit</div>
        <NavItem to="/ledger" icon="📋" label="Stock Ledger" />

        {user?.role === "admin" && (
          <>
            <div className="nav-section-label">Admin</div>
            <NavItem to="/medicines" icon="💊" label="Medicines" />
            <NavItem to="/suppliers" icon="🏭" label="Suppliers" />
            <NavItem to="/users"     icon="👤" label="Users" />
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="user-name">{user?.full_name || "—"}</div>
        <div className="user-role">{user?.role || "—"}</div>
        <button className="logout-btn" onClick={logout}>⏻ Logout</button>
      </div>
    </aside>
  );
}
