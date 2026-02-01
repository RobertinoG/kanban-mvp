import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const BOARD_STATUSES = [
  { key: "new", label: "Nuevo", color: "#dbeafe" },
  { key: "confirmed", label: "Confirmado", color: "#fde68a" },
  { key: "in_preparation", label: "En preparación", color: "#e9d5ff" },
  { key: "ready", label: "Listo", color: "#bbf7d0" },
  { key: "dispatched", label: "Despachado", color: "#bfdbfe" },
];

// Los cerrados se van a Historial
const CLOSED = new Set(["completed", "cancelled"]);

// Botones por rol (UX). La verdad final la decide RLS en DB.
const ACTIONS = {
  admin: {
    new: ["confirmed", "cancelled"],
    confirmed: ["in_preparation", "cancelled"],
    in_preparation: ["ready", "cancelled"],
    ready: ["dispatched", "cancelled"],
    dispatched: ["completed", "cancelled"],
  },
  operario: {
    new: ["confirmed", "cancelled"],
    confirmed: ["in_preparation", "cancelled"],
    in_preparation: ["ready"],
    ready: ["dispatched"],
    dispatched: ["completed"],
  },
  cocinero: {}, // sin acciones
};

function fmtTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function Kanban({ role, locationId, active }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [orders, setOrders] = useState([]);
  const [itemsByOrder, setItemsByOrder] = useState({}); // order_id -> items[]

  const canAct = role === "admin" || role === "operario";

  const load = async () => {
    setLoading(true);
    setMsg("");

    // 1) Traigo todos los pedidos activos para esta sucursal (1 query)
    const { data, error } = await supabase
      .from("orders")
      .select("id,order_number,status,customer_name,customer_phone,channel,notes,created_at,updated_at,total,currency,location_id")
      .eq("location_id", locationId)
      .order("created_at", { ascending: true });

    if (error) {
      setMsg(error.message);
      setOrders([]);
      setLoading(false);
      return;
    }

    const activeOrders = (data ?? []).filter((o) => !CLOSED.has(o.status));
    setOrders(activeOrders);

    // 2) Items: si hay pedidos, traigo items en una sola query
    const ids = activeOrders.map((o) => o.id);
    if (ids.length > 0) {
      const { data: items, error: e2 } = await supabase
        .from("order_items")
        .select("id,order_id,product_name,qty")
        .in("order_id", ids)
        .order("id", { ascending: true });

      if (e2) {
        setMsg(e2.message);
        setItemsByOrder({});
      } else {
        const map = {};
        for (const it of items ?? []) {
          if (!map[it.order_id]) map[it.order_id] = [];
          map[it.order_id].push(it);
        }
        setItemsByOrder(map);
      }
    } else {
      setItemsByOrder({});
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!active) return;

    const t = setInterval(load, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, role, locationId]);

  const columns = useMemo(() => {
    const grouped = {};
    for (const s of BOARD_STATUSES) grouped[s.key] = [];
    for (const o of orders) {
      if (grouped[o.status]) grouped[o.status].push(o);
    }
    return grouped;
  }, [orders]);

  const move = async (orderId, newStatus) => {
    setMsg("");
    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
    if (error) setMsg(error.message);
    else load();
  };

  const actionList = (status) => (ACTIONS[role]?.[status] ?? []);

  const Card = ({ o }) => {
    const items = itemsByOrder[o.id] ?? [];
    const isCook = role === "cocinero";

    return (
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          padding: 12,
          boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontWeight: 900 }}>#{o.order_number}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{fmtTime(o.created_at)}</div>
        </div>

        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
          <b>{o.channel}</b>
        </div>

        {/* Cocinero: no mostrar nombre/teléfono/$ */}
        {!isCook && (
          <div style={{ marginTop: 8, fontSize: 13 }}>
            <div style={{ fontWeight: 700 }}>{o.customer_name}</div>
            <div style={{ opacity: 0.7 }}>{o.customer_phone}</div>
          </div>
        )}

        {/* Notas del cliente: sí para todos */}
        {o.notes && (
          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              background: "#f3f4f6",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: 8,
            }}
          >
            <b>Cliente:</b> {o.notes}
          </div>
        )}

        {/* Items para cocinero/admin/operario */}
        <div style={{ marginTop: 10, fontSize: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Items</div>
          {items.length === 0 ? (
            <div style={{ opacity: 0.6 }}>Sin items</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {items.slice(0, 10).map((it) => (
                <li key={it.id}>
                  {it.qty}× {it.product_name}
                </li>
              ))}
              {items.length > 10 && <li>…y {items.length - 10} más</li>}
            </ul>
          )}
        </div>

        {/* Acciones solo para admin/operario */}
        {canAct ? (
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {actionList(o.status).map((st) => (
              <button
                key={st}
                onClick={() => move(o.id, st)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid #d1d5db",
                  background: "#111827",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                → {BOARD_STATUSES.find((x) => x.key === st)?.label || st}
              </button>
            ))}
            {actionList(o.status).length === 0 && (
              <span style={{ fontSize: 12, opacity: 0.6 }}>Sin acciones</span>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.6 }}>Sin acciones</div>
        )}

        {/* Dinero: solo admin/operario (y si querés, solo admin) */}
        {!isCook && (
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
            Total: <b>{o.currency} {Number(o.total ?? 0).toFixed(2)}</b>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Tablero Kanban</h2>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Estados activos. Completados/Cancelados van al Historial.
          {loading && <span style={{ marginLeft: 10 }}>Actualizando…</span>}
        </div>
        {msg && <div style={{ marginTop: 8, color: "crimson", fontWeight: 700 }}>{msg}</div>}
      </div>

      <div
        style={{
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: "minmax(240px, 1fr)",
          gap: 12,
          overflowX: "auto",
          paddingBottom: 6,
        }}
      >
        {BOARD_STATUSES.map((s) => (
          <div
            key={s.key}
            style={{
              border: "1px solid #e5e7eb",
              background: "#f9fafb",
              borderRadius: 16,
              padding: 10,
              minHeight: 560,
            }}
          >
            <div
              style={{
                background: s.color,
                borderRadius: 12,
                padding: "8px 10px",
                display: "flex",
                justifyContent: "space-between",
                fontWeight: 900,
              }}
            >
              <span>{s.label}</span>
              <span style={{ opacity: 0.7 }}>{(columns[s.key] ?? []).length}</span>
            </div>

            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
              {(columns[s.key] ?? []).map((o) => (
                <Card key={o.id} o={o} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
