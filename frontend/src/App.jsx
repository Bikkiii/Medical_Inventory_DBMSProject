import { useState, useEffect } from "react";
import "./index.css";

import Sidebar from "./components/Sidebar.jsx";
import Toast from "./components/Toast.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Stock from "./pages/Stock.jsx";
import Batches from "./pages/Batches.jsx";
import Sales from "./pages/Sales.jsx";
import Returns from "./pages/Returns.jsx";
import Ledger from "./pages/Ledger.jsx";
import Alerts from "./pages/Alerts.jsx";
import { apiFetch } from "./api.js";

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [toast, setToast] = useState({ message: "", type: "success" });
  const [currentUser, setCurrentUser] = useState({
    full_name: "Admin User",
    role: "admin",
  });

  useEffect(() => {
    apiFetch("/users")
      .then((users) => {
        if (users[0]) setCurrentUser(users[0]);
      })
      .catch(() => {});
  }, []);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "success" }), 3000);
  }

  function renderPage() {
    switch (activePage) {
      case "dashboard":
        return <Dashboard />;
      case "stock":
        return <Stock showToast={showToast} />;
      case "batches":
        return <Batches showToast={showToast} />;
      case "sales":
        return <Sales showToast={showToast} />;
      case "returns":
        return <Returns showToast={showToast} />;
      case "ledger":
        return <Ledger />;
      case "alerts":
        return <Alerts />;
      default:
        return <Dashboard />;
    }
  }

  return (
    <div className="app-container">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        currentUser={currentUser}
      />
      <div className="main-content">{renderPage()}</div>
      <Toast message={toast.message} type={toast.type} />
    </div>
  );
}

export default App;
