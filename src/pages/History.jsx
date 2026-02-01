import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const CARD = "#ffffff";
const TEXT = "#111827";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const BG = "#f6f7fb";

const CLOSED = ["completed", "cancelled"];

function fmtDay(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  return d.toLocaleDateString("es-AR", { weekday: "short", year: "numeric", month: "short", day: "2-digit" });
}

function fmtTime(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function money(n, currency = "ARS") {
  const x = Number(n ?? 0);
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(x);
  } catch {
    return `${currency} ${x.toFixed(2)}`;
  }
}

function StatusPill({ status }) {
  const map = {
    completed: { bg: "#dcfce7", fg: "#166534" },
    cancelled: { bg: "#fee2e2", fg: "#991b1b" },
  };
  const s = map[status] ?? { bg: "#e5e7eb", fg: "#111827" };
  return (
    <span style={{ background: s.bg, color: s.fg, padding: "2px 10px", borderRadius: 999, fontWeight: 900, fontSize: 12 }}>
      {status}
    </span>
  );
}

export default function History({ profile }) {
  const role = profile?.role ?? null;
  const locationId = profile?.location_id ?? null;

  const [days, setDays] = useState(7);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");
  const [orders, setOrders] = useState([]);
  const [finByOrderId, setFinByOrderId] = useState({});
  const [openId, setOpenId] = useState(null);

  const fromISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }, [days]);

  const load = async () => {
    setMsg("");

    try {
      let q = supabase
        .from("orders")
        .select(
          `
          id, order_number, status, customer_name, customer_phone, channel,
          created_at, updated_at, total, currency, notes, notes_ops, notes_kitchen,
          order_items ( id, product_name, qty, unit_price, line_total )
        `
        )
        .in("status", CLOSED)
        .gte("updated_at", fromISO)
        .order("updated_at", { ascending: false })
        .limit(200);

      if (locationId) q = q.eq("location_id", locationId);

      const { data, error } = await q;
      if (error) throw error;

      const s = search.trim().toLowerCase();
      const filtered =
        s.length === 0
          ? data ?? []
          : (data ?? []).filter((o) => {
              return (
                String(o.order_number ?? "").includes(s) ||
                String(o.customer_name ?? "").toLowerCase().includes(s) ||
                String(o.customer_phone ?? "").toLowerCase().includes(s)
              );
            });

      setOrders(filtered);

      // Finanzas solo admin (order_financials ya la tenés)
      if (role === "admin" && filtered.length > 0) {
        const ids = filtered.map((o) => o.id);
        const { data: fin, error: finErr } = await supabase
          .from("order_financials")
          .select("order_id,cost_total,profit_total,missing_cost_items,currency")
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
    }
  };

  // Auto-refresh silencioso más lento (historial no es “tiempo real”)
  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, role, locationId]);

  const grouped = useMemo(() => {
    const g = {};
    for (const o of orders) {
      const k = fmtDay(o.updated_at);
      if (!g[k]) g[k] = [];
      g[k].push(o);
    }
    return g;
  }, [orders]);

  const keys = useMemo(() => Object.keys(grouped), [grouped]);

  return (
    <div style={{ fontFamily: "sans-serif" }}>
      <div
        style={{
          background: BG,
          border: `1px solid ${BORDER}`,
          borderRadius: 16,
          padding: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0 }}>Historial</h2>
            <div style={{ color: MUTED, fontSize: 13 }}>
              Cerrados (completed/cancelled). Agrupados por fecha de cierre (updated_at).
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ padding: "8px 10px", borderRadius: 10, border: `1px solid ${BORDER}` }}>
              <option value={1}>Último 1 día</option>
              <option value={7}>Últimos 7 días</option>
              <option value={30}>Últimos 30 días</option>
              <option value={90}>Últimos 90 días</option>
            </select>

            <input
              placeholder="Buscar por cliente, teléfono o #pedido"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: `1px solid ${BORDER}`,
                minWidth: 320,
              }}
            />
          </div>
        </div>

        {msg && <div style={{ marginTop: 10, color: "#ef4444", fontWeight: 700 }}>{msg}</div>}

        <div style={{ marginTop: 14, color: MUTED, fontSize: 12 }}>
          Mostrando <b>{orders.length}</b> pedidos.
        </div>

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 18 }}>
          {keys.length === 0 && (
            <div style={{ background: CARD, border: `1px dashed ${BORDER}`, borderRadius: 14, padding: 14, color: MUTED }}>
              No hay pedidos cerrados en el rango seleccionado.
            </div>
          )}

          {keys.map((k) => (
            <div key={k}>
              <div style={{ fontWeight: 950, margin: "6px 0 10px 0" }}>{k}</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {grouped[k].map((o) => {
                  const fin = finByOrderId[o.id];
                  const expanded = openId === o.id;

                  return (
                    <div
                      key={o.id}
                      style={{
                        background: CARD,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 16,
                        padding: 12,
                      }}
                    >
                      {/* Row (horizontal) */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: role === "admin" ? "110px 1.2fr 1fr 1fr 140px" : "110px 1.2fr 1fr 140px",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 950 }}>#{o.order_number}</div>
                          <div style={{ color: MUTED, fontSize: 12 }}>{fmtTime(o.updated_at)}</div>
                          <div style={{ marginTop: 6 }}><StatusPill status={o.status} /></div>
                        </div>

                        <div>
                          <div style={{ fontWeight: 900 }}>{o.customer_name}</div>
                          <div style={{ color: MUTED, fontSize: 12 }}>{o.customer_phone}</div>
                          <div style={{ color: MUTED, fontSize: 12 }}>{o.channel}</div>
                        </div>

                        <div style={{ color: TEXT, fontSize: 13 }}>
                          <div><b>Total:</b> {money(o.total, o.currency)}</div>
                          {role === "admin" && fin && (
                            <>
                              <div><b>Costo:</b> {money(fin.cost_total, fin.currency)}</div>
                              <div><b>Ganancia:</b> {money(fin.profit_total, fin.currency)}</div>
                              {Number(fin.missing_cost_items ?? 0) > 0 && (
                                <div style={{ color: "#ef4444", fontWeight: 900 }}>
                                  Faltan costos en {fin.missing_cost_items} items
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        <div style={{ color: MUTED, fontSize: 12 }}>
                          {o.notes && <div><b>Cliente:</b> {o.notes}</div>}
                          {o.notes_ops && <div><b>Ops:</b> {o.notes_ops}</div>}
                          {o.notes_kitchen && <div><b>Cocina:</b> {o.notes_kitchen}</div>}
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <button
                            onClick={() => setOpenId(expanded ? null : o.id)}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 12,
                              border: `1px solid ${BORDER}`,
                              background: "#111827",
                              color: "#fff",
                              fontWeight: 900,
                              cursor: "pointer",
                            }}
                          >
                            {expanded ? "Ocultar detalle" : "Ver detalle"}
                          </button>
                        </div>
                      </div>

                      {/* Expand */}
                      {expanded && (
                        <div style={{ marginTop: 12, borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
                          <div style={{ fontWeight: 950, marginBottom: 8 }}>Items</div>
                          {(o.order_items ?? []).length === 0 ? (
                            <div style={{ color: MUTED }}>Sin items</div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {(o.order_items ?? []).map((it) => (
                                <div key={it.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                  <div style={{ opacity: 0.95 }}>
                                    {it.qty}× {it.product_name}
                                  </div>
                                  <div style={{ color: MUTED }}>
                                    {money(it.line_total ?? (Number(it.qty ?? 0) * Number(it.unit_price ?? 0)), o.currency)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Responsive */}
                      <style>{`
                        @media (max-width: 900px) {
                          div[style*="grid-template-columns: 110px 1.2fr 1fr 1fr 140px"],
                          div[style*="grid-template-columns: 110px 1.2fr 1fr 140px"] {
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
    </div>
  );
}
