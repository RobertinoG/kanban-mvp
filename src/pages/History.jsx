import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

function useInterval(fn, ms) {
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; }, [fn]);
  useEffect(() => {
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function fmtDateHeader(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "2-digit" });
}

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function statusBadge(status) {
  if (status === "completed") return <span className="badge ok">completed</span>;
  if (status === "cancelled") return <span className="badge danger">cancelled</span>;
  return <span className="badge">{status}</span>;
}

export default function History({ role, locationId }) {
  // Cocinero NO debe ver historial
  if (role === "cocinero") {
    return (
      <div className="card" style={{ padding: 14 }}>
        <b>Sin acceso.</b>
        <div className="hint">El historial está disponible para admin y operario.</div>
      </div>
    );
  }

  const [days, setDays] = useState(7);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null);

  const timeMin = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - Number(days));
    return d.toISOString();
  }, [days]);

  const load = async (silent = false) => {
    if (!locationId) return;
    if (!silent) setBusy(true);
    setMsg("");

    let query = supabase
      .from("orders")
      .select("id,order_number,status,channel,updated_at,created_at,total,currency,notes")
      .eq("location_id", locationId)
      .in("status", ["completed", "cancelled"])
      .gte("updated_at", timeMin)
      .order("updated_at", { ascending: false });

    const term = q.trim();
    if (term) {
      // búsqueda simple: order_number o notes
      // order_number es numérico; usamos ilike sobre texto en notes y channel,
      // y exact match numérico si el término es número.
      if (/^\d+$/.test(term)) query = query.eq("order_number", Number(term));
      else query = query.ilike("notes", `%${term}%`);
    }

    const { data, error } = await query;

    if (error) {
      setMsg(error.message);
      if (!silent) setBusy(false);
      return;
    }
    setRows(data || []);
    if (!silent) setBusy(false);
  };

  useEffect(() => { load(false); }, [locationId, days]); // eslint-disable-line
  useInterval(() => load(true), 6000);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = (r.updated_at || r.created_at || "").slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [rows]);

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="sectionTitle">Historial</div>
          <div className="hint">Cerrados (completed/cancelled). Agrupados por fecha de cierre (updated_at).</div>
          {msg && <div style={{ marginTop: 8, color: "#b91c1c", fontWeight: 800 }}>{msg}</div>}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select
            className="input"
            style={{ width: 160 }}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={1}>Último 1 día</option>
            <option value={3}>Últimos 3 días</option>
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
          </select>

          <input
            className="input"
            style={{ width: 320 }}
            placeholder="Buscar por #pedido (ej 12) o por nota"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") load(false);
            }}
          />

          <button className="btn" onClick={() => load(false)} disabled={busy}>
            {busy ? "Buscando..." : "Buscar"}
          </button>
        </div>
      </div>

      <div className="hint" style={{ marginTop: 10 }}>
        Mostrando {rows.length} pedidos.
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {grouped.map(([day, items]) => (
          <div key={day}>
            <div style={{ fontWeight: 900, margin: "14px 0 8px" }}>
              {day ? fmtDateHeader(day) : "Sin fecha"}
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {items.map((o) => (
                <div key={o.id} className="orderCard" style={{ marginBottom: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ minWidth: 90 }}>
                        <div className="orderId">#{o.order_number}</div>
                        <div className="orderMeta">{o.updated_at ? fmtTime(o.updated_at) : ""}</div>
                      </div>

                      <div style={{ minWidth: 120 }}>{statusBadge(o.status)}</div>

                      <div className="orderMeta">
                        {o.channel || ""}
                        {o.notes ? ` • ${o.notes}` : ""}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="badge">
                        {o.currency || "ARS"} {Number(o.total || 0).toFixed(2)}
                      </span>

                      <button
                        className="smallBtn"
                        style={{ padding: "8px 10px", fontSize: 12 }}
                        onClick={() => setModal(o)}
                      >
                        Detalle
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="modalBackdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Pedido #{modal.order_number}</div>
              <button className="btn" onClick={() => setModal(null)}>Cerrar</button>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <div><b>Estado:</b> {modal.status}</div>
              <div><b>Canal:</b> {modal.channel || "-"}</div>
              <div><b>Cierre:</b> {modal.updated_at || "-"}</div>
              <div><b>Total:</b> {modal.currency || "ARS"} {Number(modal.total || 0).toFixed(2)}</div>
              <div><b>Nota cliente:</b> {modal.notes || "-"}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
