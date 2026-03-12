import { NavLink } from "react-router-dom";
import {
  FiActivity,
  FiAlertTriangle,
  FiBookOpen,
  FiBox,
  FiCornerUpLeft,
  FiGrid,
  FiHome,
  FiList,
  FiPackage,
  FiShoppingCart,
  FiTag,
  FiTruck,
  FiUsers,
} from "react-icons/fi";
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
          <h2>Medicine IMS</h2>
        </div>
        {/* <p>Inventory Management</p> */}
      </div>

      <nav>
        <div className="nav-section-label">Main</div>
        <NavItem to="/" icon={<FiHome size={16} />} label="Dashboard" />
        <NavItem to="/stock" icon={<FiBox size={16} />} label="Stock" />
        <NavItem to="/batches" icon={<FiPackage size={16} />} label="Batches" />
        <NavItem
          to="/sales"
          icon={<FiShoppingCart size={16} />}
          label="Sales"
        />

        <div className="nav-section-label">Returns</div>
        <NavItem
          to="/returns/customer"
          icon={<FiCornerUpLeft size={16} />}
          label="Customer Return"
        />
        <NavItem
          to="/returns/damage"
          icon={<FiAlertTriangle size={16} />}
          label="Damage Report"
        />
        <NavItem
          to="/returns"
          icon={<FiList size={16} />}
          label="Returns List"
        />

        <div className="nav-section-label">Audit</div>
        <NavItem
          to="/ledger"
          icon={<FiBookOpen size={16} />}
          label="Stock Ledger"
        />

        {user?.role === "admin" && (
          <>
            <div className="nav-section-label">Admin</div>
            <NavItem
              to="/medicines"
              icon={<FiGrid size={16} />}
              label="Medicines"
            />
            <NavItem
              to="/categories"
              icon={<FiTag size={16} />}
              label="Categories"
            />
            <NavItem
              to="/suppliers"
              icon={<FiTruck size={16} />}
              label="Suppliers"
            />
            <NavItem to="/users" icon={<FiUsers size={16} />} label="Users" />
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="user-name">{user?.full_name || "—"}</div>
        <div className="user-role">{user?.role || "—"}</div>
        <button className="logout-btn" onClick={logout}>
          Logout
        </button>
      </div>
    </aside>
  );
}
