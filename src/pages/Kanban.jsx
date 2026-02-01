import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const ACTIVE_STATUSES = [
  { key: "new", label: "Nuevo", color: "#dbeafe" },
  { key: "confirmed", label: "Confirmado", color: "#fde68a" },
  { key: "in_preparation", label: "En preparación", color: "#e9d5ff" },
  { key: "ready", label: "Listo", color: "#bbf7d0" },
  { key: "dispatched", label: "Despachado", color: "#bfdbfe" },
];

// Transiciones UI por rol (si tu RLS bloquea alguna, la sacamos)
function allowedTransitions(role, currentStatus) {
  const map = {
    operario: {
      new: ["confirmed", "cancelled"],
      ready: ["dispatched", "cancelled"],
      dispatched: ["completed", "cancelled"],
      confirmed: ["cancelled"],
      in_preparation: ["cancelled"],
    },
    cocinero: {
      confirmed: ["in_preparation"],
      in_preparation: ["ready"],
    },
    admin: {
      new: ["confirmed", "in_preparation", "ready", "dispatched", "cancelled"],
      confirmed: ["in_preparation", "ready", "dispatched", "cancelled"],
      in_preparation: ["ready", "dispatched", "cancelled"],
      ready: ["dispatched", "cancelled"],
      dispatched: ["completed", "cancelled"],
    },
  };

  return map[role]?.[currentStatus] ?? [];
}

export default function Kanban({ role, locationId }) {
  const [ordersByStatus, setOrdersByStatus] = useState({});
  const [itemsByOrder, setItemsByOrder] = useState({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [notesOpsDraft, setNotesOpsDraft] = useState({});
  const [notesKitchenDraft, setNotesKitchenDraft] = useState({});

  const timerRef = useRef(null);

  const canEditOpsNotes = role === "admin" || role === "operario";
  const canEditKitchenNotes = role === "admin" || role === "cocinero";

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    setMsg("");

    // 1) Trae todos los pedidos activos en una sola query
    const { data: orders, error } = await supabase
      .from("orders")
      .select(
        "id,order_number,status,customer_name,customer_phone,channel,created_at,updated_at,is_priority,total,currency,notes_ops,notes_kitchen,delivery_address,notes"
      )
      .eq("location_id", locationId)
      .in(
        "status",
        ACTIVE_STATUSES.map((s) => s.key)
      )
      .order("created_at", { ascending: true });

    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }

    // Agrupar por status
    const next = {};
    for (const s of ACTIVE_STATUSES) next[s.key] = [];
    for (const o of orders ?? []) {
      if (!next[o.status]) next[o.status] = [];
      next[o.status].push(o);
    }
    setOrdersByStatus(next);

    // 2) Trae items de todos esos pedidos (si hay)
    const orderIds = (orders ?? []).map((o) => o.id);
    if (orderIds.length) {
      const { data: items, error: itemsErr } = await supabase
        .from("order_items")
        .select("id,order_id,product_name,qty,unit_price,line_total")
        .in("order_id", orderIds)
        .order("id", { ascending: true });

      if (itemsErr) {
        // No matamos el Kanban por items; sólo avisamos
        setMsg((m) => m || `Items: ${itemsErr.message}`);
      } else {
        const grouped = {};
        for (const it of items ?? []) {
          if (!grouped[it.order_id]) grouped[it.order_id] = [];
          grouped[it.order_id].push(it);
        }
        setItemsByOrder(grouped);
      }
    } else {
      setItemsByOrder({});
    }

    setLoading(false);
  };

  // Autorefresh silencioso cada 3s
  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 3000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const move = async (orderId, newStatus) => {
    setMsg("");
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) setMsg(error.message);
    else load();
  };

  const saveOpsNote = async (orderId) => {
    const value = notesOpsDraft[orderId] ?? "";
    const { error } = await supabase.from("orders").update({ notes_ops: value }).eq("id", orderId);
    if (error) setMsg(error.message);
    else setMsg("✅ Observación Operario/Admin guardada");
  };

  const saveKitchenNote = async (orderId) => {
    const value = notesKitchenDraft[orderId] ?? "";
    const { error } = await supabase.from("orders").update({ notes_kitchen: value }).eq("id", orderId);
    if (error) setMsg(error.message);
    else setMsg("✅ Observación Cocina guardada");
  };

  const containerStyle = {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 14,
  };

  return (
    <div style={containerStyle}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Tablero Kanban</h2>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            Estados activos. Completados/Cancelados van al Historial.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {msg && (
            <span style={{ fontSize: 12, color: msg.includes("✅") ? "#166534" : "#b91c1c" }}>
              {msg}
            </span>
          )}
          {loading && <span style={{ fontSize: 12, color: "#64748b" }}>Actualizando…</span>}
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(5, minmax(240px, 1fr))",
          overflowX: "auto",
          paddingBottom: 6,
        }}
      >
        {ACTIVE_STATUSES.map((s) => (
          <Column
            key={s.key}
            status={s}
            orders={ordersByStatus[s.key] ?? []}
            itemsByOrder={itemsByOrder}
            role={role}
            move={move}
            allowedTransitions={allowedTransitions}
            canEditOpsNotes={canEditOpsNotes}
            canEditKitchenNotes={canEditKitchenNotes}
            notesOpsDraft={notesOpsDraft}
            setNotesOpsDraft={setNotesOpsDraft}
            notesKitchenDraft={notesKitchenDraft}
            setNotesKitchenDraft={setNotesKitchenDraft}
            saveOpsNote={saveOpsNote}
            saveKitchenNote={saveKitchenNote}
          />
        ))}
      </div>
    </div>
  );
}

function Column({
  status,
  orders,
  itemsByOrder,
  role,
  move,
  allowedTransitions,
  canEditOpsNotes,
  canEditKitchenNotes,
  notesOpsDraft,
  setNotesOpsDraft,
  notesKitchenDraft,
  setNotesKitchenDraft,
  saveOpsNote,
  saveKitchenNote,
}) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 10,
        minHeight: 640,
      }}
    >
      <div
        style={{
          background: status.color,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: "10px 10px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontWeight: 900,
        }}
      >
        <span>{status.label}</span>
        <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>{orders.length}</span>
      </div>

      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
        {orders.map((o) => (
          <Card
            key={o.id}
            o={o}
            role={role}
            items={itemsByOrder[o.id] ?? []}
            transitions={allowedTransitions(role, o.status)}
            move={move}
            canEditOpsNotes={canEditOpsNotes}
            canEditKitchenNotes={canEditKitchenNotes}
            notesOpsDraft={notesOpsDraft}
            setNotesOpsDraft={setNotesOpsDraft}
            notesKitchenDraft={notesKitchenDraft}
            setNotesKitchenDraft={setNotesKitchenDraft}
            saveOpsNote={saveOpsNote}
            saveKitchenNote={saveKitchenNote}
          />
        ))}
      </div>
    </div>
  );
}

function Card({
  o,
  role,
  items,
  transitions,
  move,
  canEditOpsNotes,
  canEditKitchenNotes,
  notesOpsDraft,
  setNotesOpsDraft,
  notesKitchenDraft,
  setNotesKitchenDraft,
  saveOpsNote,
  saveKitchenNote,
}) {
  const created = new Date(o.created_at);
  const timeStr = created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const currency = o.currency || "ARS";
  const total = Number(o.total ?? 0);

  // “Detalle” por rol: lo justo y necesario para operar sin ruido
  const showCustomerBlock = role !== "cocinero"; // cocinero prioriza items/nota cocina
  const showItemsBlock = role === "cocinero" || role === "admin";
  const showAddressNotes = role === "operario" || role === "admin";

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 12,
        boxShadow: "0 1px 0 rgba(15, 23, 42, 0.04)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
          <span style={{ fontWeight: 900, fontSize: 16 }}>#{o.order_number}</span>
          <span style={{ fontSize: 12, color: "#64748b" }}>{timeStr}</span>
          {o.is_priority && (
            <span
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 999,
                background: "#fee2e2",
                color: "#991b1b",
                fontWeight: 800,
              }}
            >
              PRIORIDAD
            </span>
          )}
        </div>

        <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>
          Total: {currency} {total.toFixed(2)}
        </div>
      </div>

      {showCustomerBlock && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 800 }}>{o.customer_name || "—"}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>{o.customer_phone || "—"}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>{o.channel || "—"}</div>
        </div>
      )}

      {showAddressNotes && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#334155" }}>
          {o.delivery_address && (
            <div>
              <b>Dirección:</b> {o.delivery_address}
            </div>
          )}
          {o.notes && (
            <div style={{ marginTop: 4 }}>
              <b>Cliente:</b> {o.notes}
            </div>
          )}
        </div>
      )}

      {showItemsBlock && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>Items</div>
          {items.length === 0 ? (
            <div style={{ fontSize: 12, color: "#64748b" }}>Sin items</div>
          ) : (
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map((it) => (
                <div
                  key={it.id}
                  style={{
                    fontSize: 12,
                    background: "#f8fafc",
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: "6px 8px",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <span style={{ fontWeight: 800 }}>
                    {it.qty}× {it.product_name}
                  </span>
                  <span style={{ color: "#64748b" }}>
                    {Number(it.line_total ?? 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Observaciones */}
      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {canEditOpsNotes && (
          <NoteBox
            title="Observación Operario/Admin"
            value={notesOpsDraft[o.id] ?? o.notes_ops ?? ""}
            onChange={(v) => setNotesOpsDraft((prev) => ({ ...prev, [o.id]: v }))}
            onSave={() => saveOpsNote(o.id)}
          />
        )}

        {canEditKitchenNotes && (
          <NoteBox
            title="Observación Cocina"
            value={notesKitchenDraft[o.id] ?? o.notes_kitchen ?? ""}
            onChange={(v) => setNotesKitchenDraft((prev) => ({ ...prev, [o.id]: v }))}
            onSave={() => saveKitchenNote(o.id)}
          />
        )}
      </div>

      {/* Acciones por rol */}
      <div style={{ marginTop: 12 }}>
        {transitions.length === 0 ? (
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>Sin acciones</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {transitions.map((st) => (
              <button
                key={st}
                onClick={() => move(o.id, st)}
                style={{
                  border: "1px solid #0f172a",
                  background: "#0f172a",
                  color: "white",
                  padding: "8px 10px",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                {labelForStatus(st)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NoteBox({ title, value, onChange, onSave }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        background: "#ffffff",
        borderRadius: 12,
        padding: 10,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>{title}</div>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ej: pago por transferencia OK / sin cebolla / extra salsa…"
        style={{
          width: "100%",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: 8,
          fontSize: 12,
          resize: "vertical",
          background: "#f8fafc",
        }}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <button
          onClick={onSave}
          style={{
            border: "1px solid #0f172a",
            background: "#0f172a",
            color: "white",
            padding: "8px 12px",
            borderRadius: 10,
            fontWeight: 900,
            fontSize: 12,
          }}
        >
          Guardar
        </button>
      </div>
    </div>
  );
}

function labelForStatus(k) {
  const map = {
    confirmed: "→ Confirmado",
    in_preparation: "→ En preparación",
    ready: "→ Listo",
    dispatched: "→ Despachado",
    completed: "→ Completado",
    cancelled: "→ Cancelado",
  };
  return map[k] ?? `→ ${k}`;
}
