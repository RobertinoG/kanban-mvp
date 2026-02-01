import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const CLOSED_STATUSES = ["completed", "cancelled"];

function fmtDay(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { weekday: "short", year: "numeric", month: "short", day: "2-digit" });
}
function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export default function History({ role, locationId, active }) {
  const canSee = role === "admin" || role === "operario";
  const [days, setDays] = useState(7);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const sinceISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }, [days]);

  const load = async () => {
    if (!canSee) return;

    setLoading(true);
    setMsg("");

    const { data, error } = await supabase
      .from("orders")
      .select("id,order_number,status,customer_name,customer_phone,channel,notes,created_at,updated_at,total,currency,location_id")
      .eq("location_id", locationId)
      .in("status", CLOSED_STATUSES)
      .gte("updated_at", sinceISO)
      .order("updated_at", { ascending: false });

    if (error) {
      setMsg(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    // filtro de búsqueda simple
    const needle = q.trim().toLowerCase();
    const filtered = (data ?? []).filter((o) => {
      if (!needle) return true;
      return (
        String(o.order_number ?? "").includes(needle) ||
        String(o.customer_name ?? "").toLowerCase().includes(needle) ||
        String(o.customer_phone ?? "").toLowerCase().includes(needle)
      );
    });

    setRows(filtered);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!active) return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, days, q, locationId, role]);

  if (!canSee) {
    return (
      <div style={{ padding: 16, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16 }}>
        No tenés permiso para ver Historial.
      </div>
    );
  }

  const grouped = useMemo(() => {
    const m = new Map();
    for (const o of rows) {
      const k = fmtDay(o.updated_at);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(o);
    }
    return Array.from(m.entries());
  }, [rows]);

  const chip = (status) => {
    const styles =
      status === "completed"
        ? { bg: "#dcfce7", bd: "#86efac", tx: "#166534", label: "completed" }
        : { bg: "#fee2e2", bd: "#fca5a5", tx: "#991b1b", label: "cancelled" };
    return (
      <span
        style={{
          fontSize: 11,
          fontWeight: 800,
          padding: "3px 8px",
          borderRadius: 999,
          background: styles.bg,
          border: `1px solid ${styles.bd}`,
          color: styles.tx,
        }}
      >
        {styles.label}
      </span>
    );
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Historial</h2>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Cerrados (completed/cancelled). Agrupados por fecha de cierre (updated_at).
            {loading && <span style={{ marginLeft: 10 }}>Actualizando…</span>}
          </div>
          {msg && <div style={{ marginTop: 6, color: "crimson", fontWeight: 800 }}>{msg}</div>}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #d1d5db" }}
          >
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
              maxWidth: "70vw",
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
        Mostrando {rows.length} pedidos.
      </div>

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 14 }}>
        {grouped.map(([day, list]) => (
          <div key={day}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>{day}</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {list.map((o) => {
                const open = openId === o.id;
                return (
                  <div
                    key={o.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 14,
                      padding: 12,
                      background: "#fafafa",
                    }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 160px", gap: 10, alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 900 }}>#{o.order_number}</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>{fmtTime(o.updated_at)}</div>
                        <div style={{ marginTop: 6 }}>{chip(o.status)}</div>
                      </div>

                      <div style={{ fontSize: 13 }}>
                        <div style={{ fontWeight: 800 }}>{o.customer_name || "—"}</div>
                        <div style={{ opacity: 0.7 }}>{o.customer_phone || "—"} • {o.channel}</div>
                        {o.notes && <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}><b>Cliente:</b> {o.notes}</div>}
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>Total</div>
                        <div style={{ fontWeight: 900 }}>{o.currency} {Number(o.total ?? 0).toFixed(2)}</div>
                        <button
                          onClick={() => setOpenId(open ? null : o.id)}
                          style={{
                            marginTop: 8,
                            padding: "6px 10px",
                            borderRadius: 10,
                            border: "1px solid #d1d5db",
                            background: "#111827",
                            color: "#fff",
                            fontWeight: 800,
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          {open ? "Cerrar" : "Detalle"}
                        </button>
                      </div>
                    </div>

                    {open && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #e5e7eb", fontSize: 13 }}>
                        <div><b>ID:</b> {o.id}</div>
                        <div><b>Creado:</b> {o.created_at}</div>
                        <div><b>Actualizado:</b> {o.updated_at}</div>
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
  );
}
