import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./hooks/useAuth";
import { ToastProvider } from "./context/ToastContext";

import Sidebar from "./components/Sidebar";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import StockPage from "./pages/StockPage";
import { BatchesPage, AddBatchPage } from "./pages/BatchesPage";
import { SalesPage, NewSalePage } from "./pages/SalesPage";
import { ReturnsListPage, CustomerReturnPage, DamageReportPage } from "./pages/ReturnsPages";
import LedgerPage from "./pages/LedgerPage";
import MedicinesPage from "./pages/MedicinesPage";
import SuppliersPage from "./pages/SuppliersPage";
import UsersPage from "./pages/UsersPage";

import "./index.css";

// Layout wrapper for authenticated pages
function AppLayout({ children }) {
  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">{children}</div>
    </div>
  );
}

// Protected route — redirects to /login if not authenticated
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading" style={{ marginTop: "40vh" }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

// Admin-only route — redirects to / if not admin
function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/stock"   element={<ProtectedRoute><StockPage /></ProtectedRoute>} />

      <Route path="/batches"     element={<ProtectedRoute><BatchesPage /></ProtectedRoute>} />
      <Route path="/batches/new" element={<ProtectedRoute><AddBatchPage /></ProtectedRoute>} />

      <Route path="/sales"     element={<ProtectedRoute><SalesPage /></ProtectedRoute>} />
      <Route path="/sales/new" element={<ProtectedRoute><NewSalePage /></ProtectedRoute>} />

      <Route path="/returns"           element={<ProtectedRoute><ReturnsListPage /></ProtectedRoute>} />
      <Route path="/returns/customer"  element={<ProtectedRoute><CustomerReturnPage /></ProtectedRoute>} />
      <Route path="/returns/damage"    element={<ProtectedRoute><DamageReportPage /></ProtectedRoute>} />

      <Route path="/ledger" element={<ProtectedRoute><LedgerPage /></ProtectedRoute>} />

      <Route path="/medicines" element={<AdminRoute><MedicinesPage /></AdminRoute>} />
      <Route path="/suppliers" element={<AdminRoute><SuppliersPage /></AdminRoute>} />
      <Route path="/users"     element={<AdminRoute><UsersPage /></AdminRoute>} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
