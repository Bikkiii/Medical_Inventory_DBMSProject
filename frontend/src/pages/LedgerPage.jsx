import { useState, useEffect } from "react";
import { apiFetch } from "../api";

const txBadge = {
  purchase:         "badge-blue",
  sale:             "badge-green",
  return_in:        "badge-teal",
  return_out:       "badge-orange",
  damage_write_off: "badge-red",
};

export default function LedgerPage() {
  const [ledger,    setLedger]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [search,    setSearch]    = useState("");

  useEffect(() => {
    apiFetch("/inventory/ledger")
      .then(setLedger)
      .catch(() => setLedger([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = ledger.filter(row => {
    if (typeFilter !== "all" && row.transaction_type !== typeFilter) return false;
    if (search && !row.medicine_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div><h1>Stock Ledger</h1><p>Full audit trail of every stock movement</p></div>
      </div>

      <div className="filter-bar">
        <div className="search-wrapper">
          <input className="search-bar" placeholder="Search medicine…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All Transactions</option>
          <option value="purchase">Purchase</option>
          <option value="sale">Sale</option>
          <option value="return_in">Return In</option>
          <option value="return_out">Return Out</option>
          <option value="damage_write_off">Damage Write-Off</option>
        </select>
        <span className="td-muted">{filtered.length} entries</span>
      </div>

      {loading ? <div className="loading">Loading ledger…</div> : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Date & Time</th><th>Medicine</th>
                  <th>Batch Item</th><th>Transaction</th>
                  <th>Change</th><th>Balance</th><th>Reference</th><th>Return</th><th>By</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={10} className="empty-state">No ledger entries found.</td></tr>
                ) : filtered.map(row => (
                  <tr key={row.ledger_id}>
                    <td className="td-primary">{row.ledger_id}</td>
                    <td className="td-muted">{new Date(row.transacted_at).toLocaleString()}</td>
                    <td style={{ fontWeight: 600 }}>{row.medicine_name}</td>
                    <td className="td-primary">{row.batch_item_id}</td>
                    <td>
                      <span className={`badge ${txBadge[row.transaction_type] || "badge-gray"}`}>
                        {row.transaction_type?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className={row.quantity_change > 0 ? "text-green" : "text-red"}>
                      {row.quantity_change > 0 ? "+" : ""}{row.quantity_change}
                    </td>
                    <td style={{ fontWeight: 600 }}>{row.balance_after}</td>
                    <td className="td-muted">{row.reference_id || "-"}</td>
                    <td className="td-muted">
                      {row.return_type
                        ? row.return_type.replace(/_/g, " ") + (row.resolution ? " - " + row.resolution.replace(/_/g, " ") : "")
                        : "-"}
                    </td>
                    <td className="td-muted">{row.transacted_by_name || row.transacted_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
