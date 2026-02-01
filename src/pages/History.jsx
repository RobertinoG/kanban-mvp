import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const CLOSED = ["completed", "cancelled"];

function fmtDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  return d.toLocaleDateString("es-AR", { weekday: "short", year: "numeric", month: "short", day: "2-digit" });
}

function fmtMoney(n, currency = "ARS") {
  const x = Number(n ?? 0);
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(x);
  } catch {
    return `${currency} ${x.toFixed(2)}`;
  }
}

export default function History({ profile }) {
  const role = profile?.role ?? null;
  const locationId = profile?.location_id ?? null;

  const [days, setDays] = useState(7);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [orders, setOrders] = useState([]);
  const [finByOrderId, setFinByOrderId] = useState({}); // admin only

  const fromDateISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }, [days]);

  const load = async () => {
    setLoading(true);
    setMsg("");

    try {
      // 1) Orders cerradas, con items embebidos (si tenés FK order_items.order_id -> orders.id)
      let q = supabase
        .from("orders")
        .select(
          `
          id, order_number, status, customer_name, customer_phone, channel,
          created_at, updated_at, total, currency,
          delivery_address, notes,
          order_items ( id, product_name, qty, unit_price, line_total )
        `
        )
        .in("status", CLOSED)
        .gte("updated_at", fromDateISO)
        .order("updated_at", { ascending: false });

      // Si más adelante tenés multi-sucursal, esto evita “ruido”.
      if (locationId) q = q.eq("location_id", locationId);

      const { data, error } = await q;
      if (error) throw error;

      const list = data ?? [];

      // filtro local por búsqueda (cliente/teléfono/#pedido)
      const s = search.trim().toLowerCase();
      const filtered =
        s.length === 0
          ? list
          : list.filter((o) => {
              const hay =
                String(o.order_number ?? "").includes(s) ||
                String(o.customer_name ?? "").toLowerCase().includes(s) ||
                String(o.customer_phone ?? "").toLowerCase().includes(s);
              return hay;
            });

      setOrders(filtered);

      // 2) Finanzas solo para admin (usa tu view order_financials)
      if (role === "admin" && filtered.length > 0) {
        const ids = filtered.map((o) => o.id);

        const { data: fin, error: finErr } = await supabase
          .from("order_financials")
          .select("order_id,cost_total,profit_total,missing_cost_items,currency,total,status,location_id")
          .in("order_id", ids);

        if (finErr) throw finErr;

        const map = {};
        for (const f of fin ?? []) map[f.order_id] = f;
        setFinByOrderId(map);
      } else {
        setFinByOrderId({});
      }
    } catch (e) {
      setMsg(e.message ?? "Error cargando historial");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const grouped = useMemo(() => {
    const g = {};
    for (const o of orders) {
      const k = fmtDate(o.updated_at);
      if (!g[k]) g[k] = [];
      g[k].push(o);
    }
    return g;
  }, [orders]);

  const groupKeys = useMemo(() => Object.keys(grouped), [grouped]);

  return (
    <div style={{ padding: 14, fontFamily: "sans-serif", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Historial</h2>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={1}>Último 1 día</option>
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
          </select>

          <input
            placeholder="Buscar por cliente, teléfono o #pedido"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "6px 10px", minWidth: 260 }}
          />

          <button onClick={load} disabled={loading}>
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>
      </div>

      {msg && <div style={{ color: "crimson", marginTop: 10 }}>{msg}</div>}

      <div style={{ marginTop: 12, opacity: 0.7 }}>
        Mostrando {orders.length} pedidos cerrados (completed/cancelled). Cierre por <b>updated_at</b>.
      </div>

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 18 }}>
        {groupKeys.length === 0 && (
          <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 14, opacity: 0.7 }}>
            No hay pedidos cerrados en el rango seleccionado.
          </div>
        )}

        {groupKeys.map((day) => (
          <div key={day}>
            <h3 style={{ margin: "6px 0 10px 0" }}>{day}</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {grouped[day].map((o) => {
                const items = o.order_items ?? [];
                const fin = finByOrderId[o.id];

                // Detalle por rol (MVP)
                const showItems = role === "cocinero" || role === "admin";
                const showMoney = role === "admin" || role === "operario";

                return (
                  <div
                    key={o.id}
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: 12,
                      padding: 12,
                      display: "grid",
                      gridTemplateColumns: "120px 1.3fr 1.2fr 1fr",
                      gap: 10,
                      alignItems: "start",
                    }}
                  >
                    {/* Col 1 */}
                    <div>
                      <div style={{ fontWeight: 700 }}>#{o.order_number}</div>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>{o.status}</div>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>
                        {new Date(o.updated_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>

                    {/* Col 2 */}
                    <div>
                      <div style={{ fontWeight: 700 }}>{o.customer_name}</div>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>{o.customer_phone}</div>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>{o.channel}</div>
                      {o.delivery_address && <div style={{ opacity: 0.7, fontSize: 12 }}>📍 {o.delivery_address}</div>}
                    </div>

                    {/* Col 3 */}
                    <div>
                      {showItems ? (
                        <>
                          <div style={{ fontWeight: 700, marginBottom: 4 }}>Items</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
                            {items.length === 0 && <span style={{ opacity: 0.7 }}>Sin items</span>}
                            {items.slice(0, 5).map((it) => (
                              <span key={it.id} style={{ opacity: 0.9 }}>
                                {it.qty}× {it.product_name}
                              </span>
                            ))}
                            {items.length > 5 && <span style={{ opacity: 0.7 }}>+{items.length - 5} más…</span>}
                          </div>
                          {o.notes && <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>📝 {o.notes}</div>}
                        </>
                      ) : (
                        <div style={{ opacity: 0.7, fontSize: 12 }}>
                          (Detalle de items visible para cocina/admin)
                        </div>
                      )}
                    </div>

                    {/* Col 4 */}
                    <div>
                      {showMoney ? (
                        <>
                          <div style={{ fontWeight: 700, marginBottom: 4 }}>Resumen</div>
                          <div style={{ fontSize: 12, opacity: 0.9 }}>
                            Total: <b>{fmtMoney(o.total, o.currency)}</b>
                          </div>

                          {role === "admin" && fin && (
                            <>
                              <div style={{ fontSize: 12, opacity: 0.9 }}>
                                Costo: <b>{fmtMoney(fin.cost_total, fin.currency)}</b>
                              </div>
                              <div style={{ fontSize: 12, opacity: 0.9 }}>
                                Ganancia: <b>{fmtMoney(fin.profit_total, fin.currency)}</b>
                              </div>
                              {Number(fin.missing_cost_items ?? 0) > 0 && (
                                <div style={{ fontSize: 12, color: "crimson" }}>
                                  Faltan costos en {fin.missing_cost_items} items
                                </div>
                              )}
                            </>
                          )}

                          {role === "operario" && (
                            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                              (Luego agregamos pago: efectivo/transferencia + comprobante)
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ opacity: 0.7, fontSize: 12 }}>
                          (Resumen económico visible para operario/admin)
                        </div>
                      )}
                    </div>

                    {/* Responsive: si pantalla chica, se apila */}
                    <style>{`
                      @media (max-width: 900px) {
                        div[style*="grid-template-columns: 120px 1.3fr 1.2fr 1fr"] {
                          grid-template-columns: 1fr !important;
                        }
                      }
                    `}</style>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
