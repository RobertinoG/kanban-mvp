import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const ACTIVE_STATUSES = [
  { key: "new", label: "Nuevo", tint: "#dbeafe" },
  { key: "confirmed", label: "Confirmado", tint: "#fde68a" },
  { key: "in_preparation", label: "En preparación", tint: "#e9d5ff" },
  { key: "ready", label: "Listo", tint: "#bbf7d0" },
  { key: "dispatched", label: "Despachado", tint: "#bfdbfe" },
];

function useInterval(fn, ms) {
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; }, [fn]);
  useEffect(() => {
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function allowedTransitions(role, current) {
  // cocinero: no acciones
  if (role === "cocinero") return [];

  // operario y admin: flujo completo + cancelación (sin volver atrás)
  const canCancelFrom = ["new", "confirmed", "in_preparation", "ready", "dispatched"];
  const next = {
    new: ["confirmed"],
    confirmed: ["in_preparation"],
    in_preparation: ["ready"],
    ready: ["dispatched"],
    dispatched: ["completed"],
  };

  const list = [...(next[current] || [])];
  if (canCancelFrom.includes(current)) list.push("cancelled");
  return list;
}

const STATUS_LABEL = {
  new: "Nuevo",
  confirmed: "Confirmado",
  in_preparation: "En preparación",
  ready: "Listo",
  dispatched: "Despachado",
  completed: "Completado",
  cancelled: "Cancelado",
};

export default function Kanban({ role, locationId }) {
  const [dataByStatus, setDataByStatus] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [lastUpdate, setLastUpdate] = useState(null);

  const baseSelect = useMemo(() => {
    // cocinero NO ve totales
    if (role === "cocinero") {
      return "id,order_number,status,channel,created_at,updated_at,notes";
    }
    // admin/operario sí (si existe en tabla orders)
    return "id,order_number,status,channel,created_at,updated_at,total,currency,notes";
  }, [role]);

  const load = async (silent = false) => {
    if (!locationId) return;
    if (!silent) setBusy(true);
    setMsg("");

    const next = {};
    for (const s of ACTIVE_STATUSES) {
      const { data, error } = await supabase
        .from("orders")
        .select(baseSelect)
        .eq("location_id", locationId)
        .eq("status", s.key)
        .order("created_at", { ascending: true });

      if (error) {
        setMsg(error.message);
        if (!silent) setBusy(false);
        return;
      }
      next[s.key] = data || [];
    }

    setDataByStatus(next);
    setLastUpdate(new Date());
    if (!silent) setBusy(false);
  };

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, role]);

  // auto-refresh cada 3s (solo refresca datos; no toca tabs)
  useInterval(() => load(true), 3000);

  const move = async (orderId, newStatus) => {
    setMsg("");
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) {
      setMsg(error.message);
      return;
    }
    await load(true);
  };

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="sectionTitle">Tablero Kanban</div>
          <div className="hint">Estados activos. Completados/Cancelados van al Historial.</div>
          {msg && <div style={{ marginTop: 8, color: "#b91c1c", fontWeight: 800 }}>{msg}</div>}
        </div>

        <div className="hint" style={{ alignSelf: "flex-end" }}>
          {busy ? "Actualizando..." : lastUpdate ? `Actualizado ${fmtTime(lastUpdate.toISOString())}` : ""}
        </div>
      </div>

      <div className="gridScroll" style={{ marginTop: 12 }}>
        <div className="kanbanGrid">
          {ACTIVE_STATUSES.map((s) => (
            <div key={s.key} className="card" style={{ borderRadius: 16, overflow: "hidden" }}>
              <div className="colHeader" style={{ background: s.tint }}>
                <span>{s.label}</span>
                <span className="badge">{(dataByStatus[s.key] || []).length}</span>
              </div>

              <div className="colBody">
                {(dataByStatus[s.key] || []).map((o) => {
                  const actions = allowedTransitions(role, o.status);

                  return (
                    <div key={o.id} className="orderCard">
                      <div className="orderTop">
                        <div>
                          <div className="orderId">#{o.order_number}</div>
                          <div className="orderMeta">
                            {o.channel || ""}
                            {o.created_at ? ` • ${fmtTime(o.created_at)}` : ""}
                          </div>
                        </div>

                        {role !== "cocinero" && (
                          <div style={{ textAlign: "right" }}>
                            <div className="badge">{o.currency || "ARS"} {Number(o.total || 0).toFixed(2)}</div>
                          </div>
                        )}
                      </div>

                      {/* Nota del cliente si existe (campo notes en orders) */}
                      {o.notes && (
                        <div className="hint" style={{ marginTop: 6 }}>
                          <b>Nota cliente:</b> {o.notes}
                        </div>
                      )}

                      {/* Acciones SOLO para admin/operario */}
                      {actions.length > 0 ? (
                        <div className="actionsRow">
                          {actions.map((t) => (
                            <button
                              key={t}
                              className={`smallBtn ${t === "cancelled" ? "secondary" : ""}`}
                              onClick={() => move(o.id, t)}
                            >
                              → {STATUS_LABEL[t] || t}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="hint" style={{ marginTop: 10 }}>
                          Sin acciones
                        </div>
                      )}
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
