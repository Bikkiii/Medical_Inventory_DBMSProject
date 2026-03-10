import { currentStock, batches, sales, stockLedger } from "../data/mockData.js";

const TX_BADGE = {
  purchase: "badge-teal",
  sale: "badge-blue",
  return_in: "badge-yellow",
  damage_write_off: "badge-red",
  return_out: "badge-orange",
};

function Dashboard() {
  const lowStock = currentStock.filter(
    (s) => s.current_stock <= s.reorder_level,
  );
  const expiring = currentStock.filter((s) => {
    const d = Math.ceil((new Date(s.expiry_date) - new Date()) / 86400000);
    return d <= 90 && d > 0;
  });

  const recentLedger = [...stockLedger].reverse().slice(0, 7);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Dashboard</h1>
          <p>Overview of your inventory status</p>
        </div>
        <span
          style={{
            fontSize: 12,
            color: "var(--text-3)",
            padding: "6px 12px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          {new Date().toLocaleDateString("en-NP", { dateStyle: "long" })}
        </span>
      </div>

      {/* Stat cards */}
      <div className="stats-grid">
        <div className="stat-card teal">
          <div className="stat-icon teal">📦</div>
          <div className="stat-value">{currentStock.length}</div>
          <div className="stat-label">Total Stock Items</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon blue">🗂</div>
          <div className="stat-value">{batches.length}</div>
          <div className="stat-label">Total Batches</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-icon orange">📉</div>
          <div className="stat-value">{lowStock.length}</div>
          <div className="stat-label">Low Stock Alerts</div>
        </div>
        <div className="stat-card red">
          <div className="stat-icon red">⏰</div>
          <div className="stat-value">{expiring.length}</div>
          <div className="stat-label">Near-Expiry Items</div>
        </div>
      </div>

      <div className="two-col-wide">
        {/* Recent Ledger */}
        <div className="card">
          <div className="card-title">
            Recent Stock Ledger Entries
            <span>{recentLedger.length} entries</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Medicine</th>
                  <th>Type</th>
                  <th>Change</th>
                  <th>Balance</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentLedger.map((row) => (
                  <tr key={row.ledger_id}>
                    <td className="td-muted">{row.ledger_id}</td>
                    <td style={{ fontWeight: 500, color: "var(--text)" }}>
                      {row.medicine_name}
                    </td>
                    <td>
                      <span
                        className={`badge ${TX_BADGE[row.transaction_type] || "badge-gray"}`}
                      >
                        {row.transaction_type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td
                      style={{
                        fontWeight: 600,
                        color: row.quantity_change > 0 ? "#166534" : "#991b1b",
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 12,
                      }}
                    >
                      {row.quantity_change > 0 ? "+" : ""}
                      {row.quantity_change}
                    </td>
                    <td
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 12,
                      }}
                    >
                      {row.balance_after}
                    </td>
                    <td className="td-muted">{row.transacted_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Expiry alerts */}
          <div className="card">
            <div className="card-title">
              Expiry Alerts
              <span>{expiring.length} items</span>
            </div>
            {expiring.length === 0 ? (
              <div className="alert alert-success" style={{ marginBottom: 0 }}>
                ✓ No expiry alerts right now.
              </div>
            ) : (
              expiring.map((item) => {
                const days = Math.ceil(
                  (new Date(item.expiry_date) - new Date()) / 86400000,
                );
                return (
                  <div
                    key={item.batch_item_id}
                    style={{
                      padding: "10px 0",
                      borderBottom: "1px solid var(--border)",
                      fontSize: 13,
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "var(--text)" }}>
                      {item.medicine_name}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-3)",
                        marginTop: 2,
                      }}
                    >
                      {item.batch_no} · expires{" "}
                      <span
                        style={{
                          color: days <= 30 ? "var(--red)" : "var(--orange)",
                          fontWeight: 500,
                        }}
                      >
                        in {days} days
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Low stock */}
          <div className="card">
            <div className="card-title">
              Low Stock
              <span>{lowStock.length} items</span>
            </div>
            {lowStock.length === 0 ? (
              <div className="alert alert-success" style={{ marginBottom: 0 }}>
                ✓ All stock levels are fine.
              </div>
            ) : (
              lowStock.map((item) => (
                <div
                  key={item.batch_item_id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "9px 0",
                    borderBottom: "1px solid var(--border)",
                    fontSize: 13,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text)" }}>
                      {item.medicine_name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                      Reorder at {item.reorder_level}
                    </div>
                  </div>
                  <span className="badge badge-orange">
                    {item.current_stock} left
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Recent sales */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title">
              Recent Sales <span>{sales.length} total</span>
            </div>
            {sales.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-3)" }}>
                No sales yet.
              </p>
            ) : (
              sales.map((s) => (
                <div
                  key={s.sale_id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "9px 0",
                    borderBottom: "1px solid var(--border)",
                    fontSize: 13,
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, color: "var(--text)" }}>
                      {s.customer_name}
                    </span>
                    <span style={{ color: "var(--text-3)", marginLeft: 8 }}>
                      via {s.payment_mode}
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: "'DM Mono'",
                      fontSize: 12,
                      color: "var(--teal)",
                      fontWeight: 500,
                    }}
                  >
                    Rs. {s.total_amount.toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
