import { useState, useEffect } from "react";
import { apiFetch } from "../api";

const expiryBadge = {
  expired:           "badge-red",
  expiring_30_days:  "badge-orange",
  expiring_60_days:  "badge-yellow",
  expiring_90_days:  "badge-yellow",
  ok:                "badge-green",
};
const expiryLabel = {
  expired:           "EXPIRED",
  expiring_30_days:  "30 DAYS",
  expiring_60_days:  "60 DAYS",
  expiring_90_days:  "90 DAYS",
  ok:                "OK",
};
const stockBadge = { out_of_stock: "badge-red", low_stock: "badge-orange", ok: "" };
const stockLabel = { out_of_stock: "OUT OF STOCK", low_stock: "LOW STOCK", ok: "" };

export default function StockPage() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [expiryFilter, setExpiryFilter] = useState("all");
  const [stockFilter,  setStockFilter]  = useState("all");

  useEffect(() => {
    apiFetch("/inventory/current-stock")
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = data.filter(row => {
    const q = search.toLowerCase();
    if (q && !row.medicine_name?.toLowerCase().includes(q) && !row.batch_no?.toLowerCase().includes(q)) return false;
    if (expiryFilter !== "all" && row.expiry_status !== expiryFilter) return false;
    if (stockFilter  !== "all" && row.stock_status  !== stockFilter)  return false;
    return true;
  });

  if (loading) return <div className="loading">Loading stock data…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Stock / Inventory</h1>
          <p>Live stock levels per batch item</p>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-wrapper">
          <input className="search-bar" placeholder="Search medicine or batch…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={expiryFilter} onChange={e => setExpiryFilter(e.target.value)}>
          <option value="all">All Expiry</option>
          <option value="ok">OK</option>
          <option value="expiring_30_days">Expiring 30d</option>
          <option value="expiring_60_days">Expiring 60d</option>
          <option value="expiring_90_days">Expiring 90d</option>
          <option value="expired">Expired</option>
        </select>
        <select value={stockFilter} onChange={e => setStockFilter(e.target.value)}>
          <option value="all">All Stock Status</option>
          <option value="ok">OK</option>
          <option value="low_stock">Low Stock</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>
        <span className="td-muted">{filtered.length} rows</span>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Batch No</th>
                <th>Supplier</th>
                <th>Expiry Date</th>
                <th>Unit Price</th>
                <th>Qty in Stock</th>
                <th>Expiry Status</th>
                <th>Stock Status</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="empty-state">No stock data found.</td></tr>
              ) : filtered.map((row, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{row.medicine_name}</div>
                    {row.brand_name && <div className="td-muted">{row.brand_name}</div>}
                    {row.strength   && <div className="td-muted">{row.strength}</div>}
                  </td>
                  <td className="td-primary">{row.batch_no}</td>
                  <td>{row.supplier_name}</td>
                  <td>{new Date(row.expiry_date).toLocaleDateString()}</td>
                  <td>Rs. {parseFloat(row.unit_price).toFixed(2)}</td>
                  <td style={{ fontWeight: 700, fontSize: 15 }}>{row.current_stock}</td>
                  <td>
                    <span className={`badge ${expiryBadge[row.expiry_status] || "badge-gray"}`}>
                      {expiryLabel[row.expiry_status] || row.expiry_status}
                    </span>
                  </td>
                  <td>
                    {row.stock_status !== "ok" ? (
                      <span className={`badge ${stockBadge[row.stock_status]}`}>
                        {stockLabel[row.stock_status]}
                      </span>
                    ) : <span className="td-muted">—</span>}
                  </td>
                  <td>
                    {!row.medicine_active && <span className="badge badge-gray" style={{ marginRight: 4 }}>DISCONTINUED</span>}
                    {!row.supplier_active && <span className="badge badge-gray">SUPPLIER INACTIVE</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
