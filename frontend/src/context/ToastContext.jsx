import { useState, useCallback } from "react";

import ToastCtx from "./toastContextValue";

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  const showToast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
    if (type !== "error") window.setTimeout(() => dismiss(id), 3500);
  }, [dismiss]);

  return (
    <ToastCtx.Provider value={showToast}>
      {children}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>{t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}</span>
            <span style={{ flex: 1 }}>{t.message}</span>
            <button className="toast-close" onClick={() => dismiss(t.id)}>×</button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
