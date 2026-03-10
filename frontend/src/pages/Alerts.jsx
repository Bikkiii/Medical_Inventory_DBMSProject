import { currentStock } from "../data/mockData.js";

function Alerts() {
  const today = new Date();

  const expiry = currentStock
    .map((s) => ({
      ...s,
      days: Math.ceil((new Date(s.expiry_date) - today) / 86400000),
    }))
    .filter((s) => s.days <= 90)
    .sort((a, b) => a.days - b.days);

  const lowStock = currentStock
    .filter((s) => s.current_stock <= s.reorder_level)
    .sort((a, b) => a.current_stock - b.current_stock);

  function expiryBadge(days) {
    if (days < 0) return { cls: "badge-red", label: "EXPIRED" };
    if (days <= 30) return { cls: "badge-red", label: "Within 30 days" };
    if (days <= 60) return { cls: "badge-orange", label: "Within 60 days" };
    return { cls: "badge-yellow", label: "Within 90 days" };
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Alerts</h1>
          <p>Expiry and low-stock warnings</p>
        </div>
      </div>

      {/* Expiry Alerts */}
      <div className="card">
        <div className="card-title">
          <span style={{ color: "var(--red)", fontWeight: 700 }}>
            ⏰ Expiry Alerts
          </span>
          <span>
            View: <code>vw_expiry_alert</code> &nbsp;·&nbsp; {expiry.length}{" "}
            item(s)
          </span>
        </div>

        {expiry.length === 0 ? (
          <div className="alert alert-success">
            ✓ No expiry alerts. All stock is within safe dates.
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Batch No</th>
                  <th>Supplier</th>
                  <th>Expiry Date</th>
                  <th>Days Left</th>
                  <th>Current Stock</th>
                  <th>Alert Level</th>
                </tr>
              </thead>
              <tbody>
                {expiry.map((s) => {
                  const b = expiryBadge(s.days);
                  return (
                    <tr key={s.batch_item_id}>
                      <td style={{ fontWeight: 500, color: "var(--text)" }}>
                        {s.medicine_name}
                      </td>
                      <td className="td-primary">{s.batch_no}</td>
                      <td className="td-muted">{s.supplier}</td>
                      <td
                        style={{
                          color: s.days <= 30 ? "var(--red)" : "var(--text-2)",
                          fontWeight: s.days <= 30 ? 600 : 400,
                        }}
                      >
                        {s.expiry_date}
                      </td>
                      <td
                        style={{
                          fontFamily: "'DM Mono', monospace",
                          fontWeight: 700,
                          color:
                            s.days < 0
                              ? "var(--red)"
                              : s.days <= 30
                                ? "var(--orange)"
                                : "var(--text-2)",
                        }}
                      >
                        {s.days < 0 ? "Expired" : `${s.days}d`}
                      </td>
                      <td
                        style={{
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 13,
                        }}
                      >
                        {s.current_stock}
                      </td>
                      <td>
                        <span className={`badge ${b.cls}`}>{b.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Low Stock */}
      <div className="card">
        <div className="card-title">
          <span style={{ color: "var(--orange)", fontWeight: 700 }}>
            📉 Low Stock Alerts
          </span>
          <span>
            View: <code>vw_low_stock</code> &nbsp;·&nbsp; {lowStock.length}{" "}
            item(s)
          </span>
        </div>

        {lowStock.length === 0 ? (
          <div className="alert alert-success">
            ✓ All medicines are above their reorder levels.
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Batch No</th>
                  <th>Supplier</th>
                  <th>Reorder Level</th>
                  <th>Current Stock</th>
                  <th>Shortage</th>
                  <th>Alert</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((s) => (
                  <tr key={s.batch_item_id}>
                    <td style={{ fontWeight: 500, color: "var(--text)" }}>
                      {s.medicine_name}
                    </td>
                    <td className="td-primary">{s.batch_no}</td>
                    <td className="td-muted">{s.supplier}</td>
                    <td className="td-muted">{s.reorder_level}</td>
                    <td
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontWeight: 700,
                        color:
                          s.current_stock <= 0 ? "var(--red)" : "var(--orange)",
                      }}
                    >
                      {s.current_stock}
                    </td>
                    <td
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontWeight: 600,
                        color: "var(--red)",
                      }}
                    >
                      -{s.reorder_level - s.current_stock}
                    </td>
                    <td>
                      <span
                        className={`badge ${s.current_stock <= 0 ? "badge-red" : "badge-orange"}`}
                      >
                        {s.current_stock <= 0 ? "Out of Stock" : "Low Stock"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Alerts;
