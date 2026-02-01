import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const ACTIVE_STATUSES = [
  { key: "new", label: "Nuevo", color: "#dbeafe" },
  { key: "confirmed", label: "Confirmado", color: "#fde68a" },
  { key: "in_preparation", label: "En preparación", color: "#e9d5ff" },
  { key: "ready", label: "Listo", color: "#bbf7d0" },
  { key: "dispatched", label: "Despachado", color: "#bfdbfe" },
];

// Transiciones permitidas (UI). DB sigue siendo el árbitro final (RLS).
function allowedTransitions(role, current) {
  // Cocinero: no hace nada
  if (role === "cocinero") return [];

  // Operario: mueve el flujo normal, no cancela cuando ya está avanzado
  if (role === "operario") {
    const map = {
      new: ["confirmed", "cancelled"],
      confirmed: ["in_preparation", "cancelled"],
      in_preparation: ["ready", "cancelled"],
      ready: ["dispatched", "cancelled"],
      dispatched: ["completed"],
    };
    return map[current] || [];
  }

  // Admin: casi todo (pero no “rewind” a new si DB lo prohíbe)
  if (role === "admin") {
    const map = {
      new: ["confirmed", "cancelled"],
      confirmed: ["in_preparation", "cancelled"],
      in_preparation: ["ready", "cancelled"],
      ready: ["dispatched", "cancelled"],
      dispatched: ["completed", "cancelled"],
    };
    return map[current] || [];
  }

  return [];
}

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export default function Kanban({ role, locationId }) {
  const [ordersByStatus, setOrdersByStatus] = useState({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [tick, setTick] = useState(0);

  const canSeeMoney = role === "admin" || role === "operario";
  const canAct = role === "admin" || role === "operario";

  const selectFields = useMemo(() => {
    // Cocinero: mínimo indispensable (sin totales)
    if (!canSeeMoney) {
      return "id,order_number,status,customer_name,customer_phone,channel,created_at,updated_at,notes";
    }
    return "id,order_number,status,customer_name,customer_phone,channel,created_at,updated_at,total,currency,notes";
  }, [canSeeMoney]);

  const load = async () => {
    setLoading(true);
    setMsg("");

    const next = {};

    for (const s of ACTIVE_STATUSES) {
      let q = supabase.from("orders").select(selectFields).eq("status", s.key);

      // si querés limitar por sucursal: (por ahora una sola, pero queda listo)
      if (locationId) q = q.eq("location_id", locationId);

      const { data, error } = await q.order("created_at", { ascending: true });

      if (error) {
        setMsg(`Error ${s.key}: ${error.message}`);
        setLoading(false);
        return;
      }
      next[s.key] = data ?? [];
    }

    setOrdersByStatus(next);
    setLoading(false);
  };

  // Primera carga
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectFields, locationId]);

  // Autorefresh SOLO en Kanban
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const move = async (orderId, newStatus) => {
    setMsg("");

    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);

    if (error) setMsg(error.message);
    else load();
  };

  const statusLabel = (key) =>
    key === "in_preparation" ? "En preparación" : key === "new" ? "Nuevo" : key;

  return (
    <div>
      <div
        style={{
          background: "#fff",
          border: "1px solid #e6eaf2",
          borderRadius: 16,
          padding: 14,
          boxShadow: "0 10px 30px rgba(16,24,40,.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0 }}>Tablero Kanban</h2>
            <div style={{ opacity: 0.7, fontSize: 13 }}>
              Estados activos. Completados/Cancelados van al Historial.
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {loading ? (
              <span style={{ fontSize: 12, opacity: 0.7 }}>Actualizando...</span>
            ) : (
              <span style={{ fontSize: 12, opacity: 0.5 }}>✓</span>
            )}
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

        {/* Columns: flex horizontal scroll para teléfono/TV */}
        <div style={{ marginTop: 14, overflowX: "auto", paddingBottom: 8 }}>
          <div style={{ display: "flex", gap: 12, minWidth: 980 }}>
            {ACTIVE_STATUSES.map((s) => {
              const list = ordersByStatus[s.key] ?? [];
              return (
                <div
                  key={s.key}
                  style={{
                    flex: "0 0 240px",
                    background: "#f9fbff",
                    border: "1px solid #e6eaf2",
                    borderRadius: 16,
                    overflow: "hidden",
                  }}
                >
                  <div style={{ padding: 10, background: s.color, borderBottom: "1px solid #e6eaf2" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{s.label}</strong>
                      <span style={{ fontSize: 12, opacity: 0.7 }}>{list.length}</span>
                    </div>
                  </div>

                  <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 10, minHeight: 520 }}>
                    {list.map((o) => {
                      const transitions = allowedTransitions(role, o.status);
                      return (
                        <div
                          key={o.id}
                          style={{
                            background: "#fff",
                            border: "1px solid #e6eaf2",
                            borderRadius: 14,
                            padding: 10,
                            boxShadow: "0 6px 16px rgba(16,24,40,.06)",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                            <div style={{ fontWeight: 800 }}>#{o.order_number}</div>
                            <div style={{ fontSize: 12, opacity: 0.6 }}>{fmtTime(o.updated_at || o.created_at)}</div>
                          </div>

                          {/* Datos visibles por rol */}
                          <div style={{ marginTop: 6, fontSize: 13 }}>
                            {o.customer_name && <div style={{ fontWeight: 700 }}>{o.customer_name}</div>}
                            <div style={{ opacity: 0.75 }}>
                              {o.customer_phone ? `${o.customer_phone} · ` : ""}
                              {o.channel || ""}
                            </div>

                            {/* Nota cliente (si existe) */}
                            {o.notes ? (
                              <div
                                style={{
                                  marginTop: 8,
                                  background: "#f3f4f6",
                                  border: "1px solid #e5e7eb",
                                  borderRadius: 10,
                                  padding: 8,
                                  fontSize: 12,
                                  lineHeight: 1.2,
                                }}
                              >
                                <b>Nota cliente:</b> {o.notes}
                              </div>
                            ) : null}

                            {/* Dinero solo admin/operario */}
                            {canSeeMoney ? (
                              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
                                <b>Total:</b> {o.currency || ""} {Number(o.total || 0).toFixed(2)}
                              </div>
                            ) : null}
                          </div>

                          {/* Acciones */}
                          <div style={{ marginTop: 10 }}>
                            {!canAct || transitions.length === 0 ? (
                              <div style={{ fontSize: 12, opacity: 0.55 }}>Sin acciones</div>
                            ) : (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {transitions.map((t) => (
                                  <button
                                    key={t}
                                    onClick={() => move(o.id, t)}
                                    style={{
                                      padding: "8px 10px",
                                      borderRadius: 12,
                                      border: "1px solid #111827",
                                      background: "#111827",
                                      color: "#fff",
                                      fontSize: 12,
                                      cursor: "pointer",
                                    }}
                                  >
                                    → {statusLabel(t)}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
