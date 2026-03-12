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

const groupStockRows = (rows, reorderMap) => {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = [
      row.medicine_id,
      row.batch_no,
      row.expiry_date,
      row.unit_price,
      row.supplier_name,
    ].join(":");
    const existing = grouped.get(key);
    const current = Number(row.current_stock) || 0;
    if (!existing) {
      grouped.set(key, {
        ...row,
        group_key: key,
        batch_item_ids: [row.batch_item_id],
        current_stock: current,
      });
      return;
    }
    existing.batch_item_ids.push(row.batch_item_id);
    existing.current_stock += current;
  });

  return Array.from(grouped.values()).map((row) => {
    const reorderLevel = reorderMap.get(row.medicine_id);
    let stock_status = row.stock_status;
    if (typeof reorderLevel === "number") {
      if (row.current_stock <= 0) stock_status = "out_of_stock";
      else if (row.current_stock <= reorderLevel) stock_status = "low_stock";
      else stock_status = "ok";
    } else if (row.current_stock <= 0) {
      stock_status = "out_of_stock";
    }
    return { ...row, stock_status };
  });
};

export default function StockPage() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [expiryFilter, setExpiryFilter] = useState("all");
  const [stockFilter,  setStockFilter]  = useState("all");

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      apiFetch("/inventory/current-stock").catch(() => []),
      apiFetch("/medicines").catch(() => []),
    ])
      .then(([stockRows, meds]) => {
        if (!active) return;
        const reorderMap = new Map(
          (meds || []).map((m) => [m.medicine_id, Number(m.reorder_level)]),
        );
        setData(groupStockRows(stockRows || [], reorderMap));
      })
      .catch(() => {
        if (!active) return;
        setData([]);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filtered = data.filter(row => {
    const q = search.toLowerCase();
    if (q && !row.medicine_name?.toLowerCase().includes(q) && !row.batch_no?.toLowerCase().includes(q)) return false;
    if (expiryFilter !== "all" && row.expiry_status !== expiryFilter) return false;
    if (stockFilter  !== "all" && row.stock_status  !== stockFilter)  return false;
    return true;
  }).sort((a, b) =>
    new Date(a.expiry_date) - new Date(b.expiry_date) ||
    a.medicine_name.localeCompare(b.medicine_name) ||
    a.batch_no.localeCompare(b.batch_no)
  );

  if (loading) return <div className="loading">Loading stock data…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Stock / Inventory</h1>
          <p>Live stock levels (merged by batch & expiry)</p>
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
                <tr key={row.group_key || i}>
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
