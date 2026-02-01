import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

function groupByDate(rows) {
  const map = new Map();
  for (const r of rows) {
    const d = new Date(r.updated_at || r.created_at);
    const key = d.toLocaleDateString("es-AR", { weekday: "short", year: "numeric", month: "short", day: "2-digit" });
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return Array.from(map.entries());
}

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export default function History({ role, locationId }) {
  const allowed = role === "admin" || role === "operario";
  const [days, setDays] = useState(7);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");
  const [detail, setDetail] = useState(null);

  const sinceISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - Number(days || 7));
    return d.toISOString();
  }, [days]);

  const load = async () => {
    setMsg("");

    if (!allowed) return;

    let query = supabase
      .from("orders")
      .select("id,order_number,status,customer_name,customer_phone,channel,total,currency,notes,created_at,updated_at")
      .in("status", ["completed", "cancelled"])
      .gte("updated_at", sinceISO);

    if (locationId) query = query.eq("location_id", locationId);

    if (q.trim()) {
      // filtro simple: por nombre, teléfono o #pedido
      const like = `%${q.trim()}%`;
      query = query.or(
        `customer_name.ilike.${like},customer_phone.ilike.${like},order_number::text.ilike.${like}`
      );
    }

    const { data, error } = await query.order("updated_at", { ascending: false });

    if (error) setMsg(error.message);
    else setRows(data ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, q, locationId, allowed]);

  if (!allowed) {
    return (
      <div style={{ padding: 14, background: "#fff", border: "1px solid #e6eaf2", borderRadius: 16 }}>
        No autorizado.
      </div>
    );
  }

  const grouped = groupByDate(rows);

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e6eaf2",
        borderRadius: 16,
        padding: 14,
        boxShadow: "0 10px 30px rgba(16,24,40,.06)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Historial</h2>
          <div style={{ opacity: 0.7, fontSize: 13 }}>
            Cerrados (completed/cancelled). Agrupados por fecha de cierre (updated_at).
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid #d6dbe6" }}
          >
            <option value={1}>Últimas 24h</option>
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
          </select>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por cliente, teléfono o #pedido"
            style={{
              width: 320,
              maxWidth: "100%",
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid #d6dbe6",
              outline: "none",
            }}
          />
        </div>
      </div>

      {msg && (
        <div
          style={{
            marginTop: 10,
            background: "#fff3f3",
            border: "1px solid #ffd1d1",
            padding: 10,
            borderRadius: 12,
            color: "#b42318",
            fontSize: 13,
          }}
        >
          {msg}
        </div>
      )}

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
        {grouped.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Sin pedidos cerrados en el período.</div>
        ) : null}

        {grouped.map(([day, list]) => (
          <div key={day}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>{day}</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {list.map((o) => (
                <div
                  key={o.id}
                  style={{
                    border: "1px solid #e6eaf2",
                    borderRadius: 14,
                    padding: 12,
                    display: "grid",
                    gridTemplateColumns: "140px 1fr 220px 90px",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>#{o.order_number}</div>
                    <div style={{ fontSize: 12, opacity: 0.65 }}>{fmtTime(o.updated_at || o.created_at)}</div>
                    <span
                      style={{
                        display: "inline-block",
                        marginTop: 6,
                        fontSize: 12,
                        padding: "2px 10px",
                        borderRadius: 999,
                        border: "1px solid #e6eaf2",
                        background: o.status === "completed" ? "#dcfce7" : "#fee2e2",
                      }}
                    >
                      {o.status}
                    </span>
                  </div>

                  <div style={{ fontSize: 13 }}>
                    <div style={{ fontWeight: 700 }}>{o.customer_name || "-"}</div>
                    <div style={{ opacity: 0.75 }}>
                      {o.customer_phone ? `${o.customer_phone} · ` : ""}{o.channel || ""}
                    </div>
                    {o.notes ? (
                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                        <b>Nota:</b> {o.notes}
                      </div>
                    ) : null}
                  </div>

                  <div style={{ fontSize: 13, textAlign: "right" }}>
                    <div style={{ opacity: 0.7 }}>Total</div>
                    <div style={{ fontWeight: 900 }}>
                      {o.currency || ""} {Number(o.total || 0).toFixed(2)}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <button
                      onClick={() => setDetail(o)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 12,
                        border: "1px solid #111827",
                        background: "#111827",
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Detalle
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modal detalle (simple) */}
      {detail && (
        <div
          onClick={() => setDetail(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.35)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
            padding: 14,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 620,
              background: "#fff",
              borderRadius: 16,
              border: "1px solid #e6eaf2",
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>Pedido #{detail.order_number}</div>
                <div style={{ opacity: 0.7, fontSize: 13 }}>
                  {detail.status} · {detail.channel}
                </div>
              </div>
              <button
                onClick={() => setDetail(null)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid #d6dbe6",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Cerrar
              </button>
            </div>

            <div style={{ marginTop: 12, fontSize: 13 }}>
              <div><b>Cliente:</b> {detail.customer_name || "-"}</div>
              <div><b>Tel:</b> {detail.customer_phone || "-"}</div>
              <div style={{ marginTop: 10 }}>
                <b>Total:</b> {detail.currency || ""} {Number(detail.total || 0).toFixed(2)}
              </div>
              {detail.notes ? (
                <div style={{ marginTop: 10 }}>
                  <b>Nota cliente:</b> {detail.notes}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
