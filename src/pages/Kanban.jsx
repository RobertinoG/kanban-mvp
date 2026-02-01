import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

// Solo estados de TRABAJO (cerrados van al Historial)
const ACTIVE_STATUSES = [
  { key: "new", label: "Nuevo" },
  { key: "confirmed", label: "Confirmado" },
  { key: "in_preparation", label: "En preparación" },
  { key: "ready", label: "Listo" },
  { key: "dispatched", label: "Despachado" },
];

const ROLE_TRANSITIONS = {
  operario: {
    new: ["confirmed"],
    ready: ["dispatched"],
    dispatched: ["completed"], // se moverá al historial cuando cambie
  },
  cocinero: {
    confirmed: ["in_preparation"],
    in_preparation: ["ready"],
  },
  admin: {
    new: ["confirmed", "cancelled"],
    confirmed: ["in_preparation", "cancelled"],
    in_preparation: ["ready", "cancelled"],
    ready: ["dispatched", "cancelled"],
    dispatched: ["completed", "cancelled"],
  },
};

function allowedTargets(role, currentStatus) {
  const r = ROLE_TRANSITIONS[role] ?? {};
  return r[currentStatus] ?? [];
}

export default function Kanban({ profile }) {
  const role = profile?.role ?? null;

  const [ordersByStatus, setOrdersByStatus] = useState({});
  const [msg, setMsg] = useState("");

  // mobile tabs
  const [activeStatus, setActiveStatus] = useState("new");
  const isMobile = useMemo(
    () => window.matchMedia && window.matchMedia("(max-width: 900px)").matches,
    []
  );

  const load = async () => {
    setMsg("");

    // Trae todos los pedidos ACTIVOS en una sola query
    const activeKeys = ACTIVE_STATUSES.map((s) => s.key);

    const { data, error } = await supabase
      .from("orders")
      .select("id,order_number,status,customer_name,customer_phone,channel,created_at,updated_at,is_priority")
      .in("status", activeKeys)
      .order("created_at", { ascending: true });

    if (error) {
      setMsg(error.message);
      return;
    }

    const next = {};
    for (const s of ACTIVE_STATUSES) next[s.key] = [];
    for (const o of data ?? []) {
      if (!next[o.status]) next[o.status] = [];
      next[o.status].push(o);
    }

    setOrdersByStatus(next);
  };

  // Auto-refresh silencioso
  useEffect(() => {
    load();
    const t = setInterval(load, 3000); // 3s
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atajo opcional: tecla R para refrescar manual
  useEffect(() => {
    const onKey = (e) => {
      if (e.key?.toLowerCase() === "r") load();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const move = async (orderId, newStatus) => {
    setMsg("");
    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
    if (error) setMsg(error.message);
    else load();
  };

  const renderColumn = (s) => (
    <div key={s.key} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10, minHeight: 520 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong>{s.label}</strong>
        <span style={{ opacity: 0.7 }}>{(ordersByStatus[s.key] ?? []).length}</span>
      </div>

      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
        {(ordersByStatus[s.key] ?? []).map((o) => {
          const targets = allowedTargets(role, o.status);

          return (
            <div key={o.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>#{o.order_number}</strong>
                {o.is_priority && <span>⚡</span>}
              </div>

              <div style={{ fontSize: 13, marginTop: 6 }}>
                <div>{o.customer_name}</div>
                <div style={{ opacity: 0.7 }}>{o.customer_phone}</div>
                <div style={{ opacity: 0.7 }}>{o.channel}</div>
              </div>

              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {!role && <span style={{ opacity: 0.7, fontSize: 12 }}>Cargando rol...</span>}

                {role && targets.length === 0 && (
                  <span style={{ opacity: 0.6, fontSize: 12 }}>Sin acciones</span>
                )}

                {role &&
                  targets.map((next) => {
                    // Traducción de label (incluye completed/cancelled aunque no estén en ACTIVE_STATUSES)
                    const label =
                      ACTIVE_STATUSES.find((x) => x.key === next)?.label ??
                      (next === "completed" ? "Completado" : next === "cancelled" ? "Cancelado" : next);

                    return (
                      <button
                        key={next}
                        style={{ fontSize: 11, padding: "6px 8px" }}
                        onClick={() => move(o.id, next)}
                      >
                        → {label}
                      </button>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const gridStyle = isMobile
    ? { display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 12 }
    : { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginTop: 12 };

  return (
    <div style={{ padding: 14, fontFamily: "sans-serif" }}>
      <h2 style={{ margin: 0 }}>Kanban</h2>
      {msg && <div style={{ color: "crimson", marginTop: 8 }}>{msg}</div>}

      {/* Mobile tabs */}
      {isMobile && (
        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ACTIVE_STATUSES.map((s) => (
            <button
              key={s.key}
              onClick={() => setActiveStatus(s.key)}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #ddd",
                opacity: activeStatus === s.key ? 1 : 0.6,
              }}
            >
              {s.label} ({(ordersByStatus[s.key] ?? []).length})
            </button>
          ))}
        </div>
      )}

      <div style={gridStyle}>
        {isMobile
          ? renderColumn(ACTIVE_STATUSES.find((x) => x.key === activeStatus) ?? ACTIVE_STATUSES[0])
          : ACTIVE_STATUSES.map(renderColumn)}
      </div>
    </div>
  );
}
