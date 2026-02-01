import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const BG = "#f6f7fb";
const CARD = "#ffffff";
const TEXT = "#111827";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

const ACTIVE_STATUSES = [
  { key: "new", label: "Nuevo", head: "#dbeafe" },            // azul suave
  { key: "confirmed", label: "Confirmado", head: "#fde68a" }, // amarillo suave
  { key: "in_preparation", label: "En preparación", head: "#e9d5ff" }, // violeta suave
  { key: "ready", label: "Listo", head: "#bbf7d0" },          // verde suave
  { key: "dispatched", label: "Despachado", head: "#e5e7eb" },// gris suave
];

// Transiciones por rol (ajustado a lo que venís usando)
const ROLE_TRANSITIONS = {
  operario: {
    new: ["confirmed"],
    ready: ["dispatched"],
    dispatched: ["completed"],
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

function statusLabel(key) {
  const f = ACTIVE_STATUSES.find((x) => x.key === key);
  if (f) return f.label;
  if (key === "completed") return "Completado";
  if (key === "cancelled") return "Cancelado";
  return key;
}

function allowedTargets(role, currentStatus) {
  const r = ROLE_TRANSITIONS[role] ?? {};
  return r[currentStatus] ?? [];
}

function money(n, currency = "ARS") {
  const x = Number(n ?? 0);
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(x);
  } catch {
    return `${currency} ${x.toFixed(2)}`;
  }
}

export default function Kanban({ profile }) {
  const role = profile?.role ?? null;
  const locationId = profile?.location_id ?? null;

  const [ordersByStatus, setOrdersByStatus] = useState({});
  const [msg, setMsg] = useState("");

  // Observaciones: draft por orderId
  const [draftNotes, setDraftNotes] = useState({});
  const [savingNote, setSavingNote] = useState({}); // orderId -> bool

  // Mobile: vista por tabs
  const [activeStatus, setActiveStatus] = useState("new");
  const isMobile = useMemo(
    () => window.matchMedia && window.matchMedia("(max-width: 900px)").matches,
    []
  );

  const load = async () => {
    setMsg("");

    const activeKeys = ACTIVE_STATUSES.map((s) => s.key);

    // Traemos más campos para la UI por rol
    // (items sólo si es cocinero/admin, usando relación order_items)
    const selectBase =
      "id,order_number,status,customer_name,customer_phone,channel,created_at,updated_at,is_priority,total,currency,notes,notes_ops,notes_kitchen";

    const selectWithItems =
      `${selectBase},order_items(id,product_name,qty,unit_price,line_total)`;

    let q = supabase
      .from("orders")
      .select(role === "cocinero" || role === "admin" ? selectWithItems : selectBase)
      .in("status", activeKeys)
      .order("created_at", { ascending: true });

    if (locationId) q = q.eq("location_id", locationId);

    const { data, error } = await q;

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

  // Auto-refresh silencioso cada 3s
  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, locationId]);

  const move = async (orderId, newStatus) => {
    setMsg("");
    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
    if (error) setMsg(error.message);
    else load();
  };

  const canEditOps = role === "operario" || role === "admin";
  const canEditKitchen = role === "cocinero" || role === "admin";

  const saveNote = async (orderId, field, value) => {
    setSavingNote((p) => ({ ...p, [orderId]: true }));
    setMsg("");

    const patch = {};
    patch[field] = value;

    const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
    if (error) setMsg(error.message);
    else load();

    setSavingNote((p) => ({ ...p, [orderId]: false }));
  };

  const renderCard = (o) => {
    const targets = allowedTargets(role, o.status);

    // Detalle por rol
    const showItems = role === "cocinero" || role === "admin";
    const items = o.order_items ?? [];

    // Draft notes
    const opsKey = `ops:${o.id}`;
    const kitKey = `kit:${o.id}`;
    const opsVal = draftNotes[opsKey] ?? (o.notes_ops ?? "");
    const kitVal = draftNotes[kitKey] ?? (o.notes_kitchen ?? "");

    return (
      <div
        key={o.id}
        style={{
          border: `1px solid ${BORDER}`,
          borderRadius: 14,
          padding: 12,
          background: CARD,
          boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>#{o.order_number}</div>
            {o.is_priority && (
              <span
                style={{
                  fontSize: 12,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "#fee2e2",
                  color: "#991b1b",
                  fontWeight: 800,
                }}
              >
                ⚡ Prioridad
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: MUTED }}>
            {new Date(o.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 800 }}>{o.customer_name}</div>
          <div style={{ color: MUTED, fontSize: 12 }}>{o.customer_phone} • {o.channel}</div>
          {(role === "admin" || role === "operario") && (
            <div style={{ marginTop: 6, fontSize: 13 }}>
              <span style={{ color: MUTED }}>Total:</span>{" "}
              <b>{money(o.total, o.currency)}</b>
            </div>
          )}
        </div>

        {/* Notas del cliente (si existen) */}
        {o.notes && (
          <div style={{ marginTop: 8, fontSize: 12, color: TEXT, background: "#f9fafb", border: `1px dashed ${BORDER}`, padding: 8, borderRadius: 10 }}>
            <b>Cliente:</b> {o.notes}
          </div>
        )}

        {/* Items para cocina/admin */}
        {showItems && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 12, color: MUTED, marginBottom: 6 }}>Items</div>
            {items.length === 0 ? (
              <div style={{ color: MUTED, fontSize: 12 }}>Sin items</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                {items.slice(0, 6).map((it) => (
                  <div key={it.id} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ opacity: 0.95 }}>{it.qty}× {it.product_name}</span>
                    <span style={{ color: MUTED }}>
                      {money(it.line_total ?? (Number(it.qty ?? 0) * Number(it.unit_price ?? 0)), o.currency)}
                    </span>
                  </div>
                ))}
                {items.length > 6 && <div style={{ color: MUTED }}>+{items.length - 6} más…</div>}
              </div>
            )}
          </div>
        )}

        {/* Observaciones por rol */}
        {(canEditOps || canEditKitchen) && (
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
            {canEditOps && (
              <div style={{ background: "#f9fafb", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 10 }}>
                <div style={{ fontWeight: 900, fontSize: 12, color: MUTED, marginBottom: 6 }}>
                  Observación Operario/Admin
                </div>
                <textarea
                  value={opsVal}
                  onChange={(e) => setDraftNotes((p) => ({ ...p, [opsKey]: e.target.value }))}
                  rows={2}
                  placeholder="Ej: pago por transferencia OK / falta comprobante / llamar cliente…"
                  style={{ width: "100%", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 8, resize: "vertical" }}
                />
                <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => saveNote(o.id, "notes_ops", opsVal)}
                    disabled={!!savingNote[o.id]}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: `1px solid ${BORDER}`,
                      background: "#111827",
                      color: "#fff",
                      fontWeight: 800,
                      cursor: "pointer",
                      opacity: savingNote[o.id] ? 0.6 : 1,
                    }}
                  >
                    {savingNote[o.id] ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              </div>
            )}

            {canEditKitchen && (
              <div style={{ background: "#f9fafb", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 10 }}>
                <div style={{ fontWeight: 900, fontSize: 12, color: MUTED, marginBottom: 6 }}>
                  Observación Cocina
                </div>
                <textarea
                  value={kitVal}
                  onChange={(e) => setDraftNotes((p) => ({ ...p, [kitKey]: e.target.value }))}
                  rows={2}
                  placeholder="Ej: sin cebolla / extra salsa / listo para retirar…"
                  style={{ width: "100%", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 8, resize: "vertical" }}
                />
                <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => saveNote(o.id, "notes_kitchen", kitVal)}
                    disabled={!!savingNote[o.id]}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: `1px solid ${BORDER}`,
                      background: "#111827",
                      color: "#fff",
                      fontWeight: 800,
                      cursor: "pointer",
                      opacity: savingNote[o.id] ? 0.6 : 1,
                    }}
                  >
                    {savingNote[o.id] ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Acciones (solo válidas por rol) */}
        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {!role && <span style={{ color: MUTED, fontSize: 12 }}>Cargando rol…</span>}

          {role && targets.length === 0 && (
            <span style={{ color: MUTED, fontSize: 12 }}>Sin acciones</span>
          )}

          {role &&
            targets.map((next) => (
              <button
                key={next}
                onClick={() => move(o.id, next)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: `1px solid ${BORDER}`,
                  background: "#fff",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                → {statusLabel(next)}
              </button>
            ))}
        </div>
      </div>
    );
  };

  const renderColumn = (s) => (
    <div
      key={s.key}
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        overflow: "hidden",
        background: "#fff",
        minHeight: 640,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ background: s.head, padding: 12, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div style={{ fontWeight: 950 }}>{s.label}</div>
          <div style={{ fontSize: 12, color: MUTED }}>
            {(ordersByStatus[s.key] ?? []).length}
          </div>
        </div>
      </div>

      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        {(ordersByStatus[s.key] ?? []).map(renderCard)}
      </div>
    </div>
  );

  const gridStyle = isMobile
    ? { display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 14 }
    : { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginTop: 14 };

  return (
    <div style={{ fontFamily: "sans-serif", color: TEXT }}>
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
            <h2 style={{ margin: 0 }}>Tablero Kanban</h2>
            <div style={{ color: MUTED, fontSize: 13 }}>
              Estados activos. Completados/Cancelados van al Historial.
            </div>
          </div>

          {msg && (
            <div style={{ color: "#ef4444", fontSize: 13, fontWeight: 700 }}>
              {msg}
            </div>
          )}
        </div>

        {/* Mobile tabs */}
        {isMobile && (
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {ACTIVE_STATUSES.map((s) => (
              <button
                key={s.key}
                onClick={() => setActiveStatus(s.key)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 999,
                  border: `1px solid ${activeStatus === s.key ? "#111827" : BORDER}`,
                  background: activeStatus === s.key ? "#111827" : "#fff",
                  color: activeStatus === s.key ? "#fff" : TEXT,
                  fontWeight: 900,
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
    </div>
  );
}
