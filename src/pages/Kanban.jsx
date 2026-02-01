import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const ACTIVE_STATUSES = [
  { key: "new", label: "Nuevo" },
  { key: "confirmed", label: "Confirmado" },
  { key: "in_preparation", label: "En preparación" },
  { key: "ready", label: "Listo" },
  { key: "dispatched", label: "Despachado" },
];

// “Botones” visibles por rol (frontend). La DB igual valida.
function allowedTargets(role, currentStatus) {
  if (!(role === "admin" || role === "operario")) return []; // cocinero read-only

  const flow = {
    new: ["confirmed", "cancelled"],
    confirmed: ["in_preparation", "cancelled"],
    in_preparation: ["ready", "cancelled"],
    ready: ["dispatched", "cancelled"],
    dispatched: ["completed", "cancelled"],
  };

  return flow[currentStatus] ?? [];
}

export default function Kanban({ role, locationId, canDoActions }) {
  const [byStatus, setByStatus] = useState({});
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastTs, setLastTs] = useState(null);

  const statuses = useMemo(() => ACTIVE_STATUSES, []);

  const load = async () => {
    setLoading(true);
    setMsg("");

    try {
      const next = {};

      for (const s of statuses) {
        let q = supabase
          .from("orders")
          .select("id,order_number,status,customer_name,customer_phone,channel,created_at,updated_at,total,currency,is_priority")
          .eq("status", s.key)
          .order("created_at", { ascending: true });

        // Si querés forzar por location (opcional) — si RLS ya filtra, no hace falta.
        if (locationId) q = q.eq("location_id", locationId);

        const { data, error } = await q;
        if (error) throw error;

        next[s.key] = data ?? [];
      }

      setByStatus(next);
      setLastTs(new Date());
    } catch (e) {
      setMsg(e.message ?? "Error cargando Kanban");
    } finally {
      setLoading(false);
    }
  };

  // Auto refresh “silencioso”
  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [locationId]);

  const move = async (orderId, newStatus) => {
    setMsg("");
    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
    if (error) setMsg(error.message);
    else load();
  };

  return (
    <div style={{ fontFamily: "system-ui" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0 }}>Tablero Kanban</h2>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Activos: {ACTIVE_STATUSES.map(s => s.label).join(" · ")}. (Completado/Cancelado quedan en Historial)
          </div>
        </div>

        <div style={{ textAlign: "right", fontSize: 12, opacity: 0.7 }}>
          {loading ? "Actualizando…" : lastTs ? `Última actualización: ${lastTs.toLocaleTimeString()}` : ""}
          {msg && <div style={{ color: "crimson", opacity: 1 }}>{msg}</div>}
        </div>
      </div>

      {/* Contenedor scrolleable horizontal (PC/TV/phone friendly) */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 12,
          overflowX: "auto",
          paddingBottom: 10,
        }}
      >
        {statuses.map((s) => (
          <div
            key={s.key}
            style={{
              minWidth: 280,
              maxWidth: 320,
              flex: "0 0 auto",
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: 10,
              boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <strong>{s.label}</strong>
              <span
                style={{
                  fontSize: 12,
                  background: "#f3f4f6",
                  border: "1px solid #e5e7eb",
                  padding: "2px 8px",
                  borderRadius: 999,
                }}
              >
                {(byStatus[s.key] ?? []).length}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(byStatus[s.key] ?? []).map((o) => {
                const targets = allowedTargets(role, o.status);

                return (
                  <div
                    key={o.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 14,
                      padding: 10,
                      background: "#fafafa",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontWeight: 800 }}>#{o.order_number}</div>
                      {o.is_priority && (
                        <span style={{ fontSize: 12, background: "#fee2e2", border: "1px solid #fecaca", padding: "2px 8px", borderRadius: 999 }}>
                          ⚡ Prioridad
                        </span>
                      )}
                    </div>

                    <div style={{ marginTop: 6, fontSize: 13 }}>
                      <div style={{ fontWeight: 700 }}>{o.customer_name}</div>
                      <div style={{ opacity: 0.75 }}>{o.customer_phone}</div>
                      <div style={{ opacity: 0.75 }}>{o.channel}</div>
                      <div style={{ marginTop: 6, fontWeight: 700 }}>
                        Total: {formatMoney(o.total, o.currency)}
                      </div>
                    </div>

                    {/* Acciones */}
                    <div style={{ marginTop: 10 }}>
                      {!canDoActions || targets.length === 0 ? (
                        <div style={{ fontSize: 12, opacity: 0.6 }}>Sin acciones</div>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {targets.map((t) => (
                            <button
                              key={t}
                              onClick={() => move(o.id, t)}
                              style={{
                                padding: "8px 10px",
                                borderRadius: 10,
                                border: "1px solid #111827",
                                background: "#111827",
                                color: "white",
                                cursor: "pointer",
                                fontWeight: 700,
                                fontSize: 12,
                              }}
                            >
                              → {labelOf(t)}
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
        ))}
      </div>
    </div>
  );
}

function labelOf(status) {
  const map = {
    new: "Nuevo",
    confirmed: "Confirmado",
    in_preparation: "En preparación",
    ready: "Listo",
    dispatched: "Despachado",
    completed: "Completado",
    cancelled: "Cancelado",
  };
  return map[status] ?? status;
}

function formatMoney(val, currency) {
  const n = Number(val ?? 0);
  const c = currency || "ARS";
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: c,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${c} ${n.toFixed(0)}`;
  }
}
