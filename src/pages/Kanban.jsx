import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const STATUSES = [
  { key: "new", label: "Nuevo" },
  { key: "confirmed", label: "Confirmado" },
  { key: "in_preparation", label: "En preparación" },
  { key: "ready", label: "Listo" },
  { key: "dispatched", label: "Despachado" },
  { key: "completed", label: "Completado" },
  { key: "cancelled", label: "Cancelado" },
];

export default function Kanban() {
  const [ordersByStatus, setOrdersByStatus] = useState({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // evita que se pisen llamadas si el intervalo dispara mientras aún está cargando
  const inFlight = useRef(false);

  const load = async () => {
    if (inFlight.current) return;
    inFlight.current = true;

    setLoading(true);
    setMsg("");

    try {
      const next = {};

      for (const s of STATUSES) {
        const { data, error } = await supabase
          .from("orders")
          .select(
            "id,order_number,status,customer_name,customer_phone,channel,created_at,updated_at,is_priority"
          )
          .eq("status", s.key)
          .order("created_at", { ascending: true });

        if (error) throw new Error(`Error ${s.key}: ${error.message}`);
        next[s.key] = data ?? [];
      }

      setOrdersByStatus(next);
    } catch (e) {
      setMsg(e.message ?? "Error desconocido");
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  };

  // ✅ Auto-refresh dentro del componente y en un solo useEffect
  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // cada 5s (recomendado)
    return () => clearInterval(t);
  }, []);

  const move = async (orderId, newStatus) => {
    setMsg("");
    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
    if (error) setMsg(error.message);
    else load();
  };

  return (
    <div style={{ padding: 14, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Kanban</h2>
        <button onClick={load} disabled={loading}>
          {loading ? "Cargando..." : "Refrescar"}
        </button>
        {msg && <span style={{ color: "crimson" }}>{msg}</span>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10, marginTop: 12 }}>
        {STATUSES.map((s) => (
          <div
            key={s.key}
            style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10, minHeight: 600 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{s.label}</strong>
              <span style={{ opacity: 0.7 }}>{(ordersByStatus[s.key] ?? []).length}</span>
            </div>

            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
              {(ordersByStatus[s.key] ?? []).map((o) => (
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
                    {STATUSES.filter((t) => t.key !== o.status).map((t) => (
                      <button
                        key={t.key}
                        style={{ fontSize: 11, padding: "6px 8px" }}
                        onClick={() => move(o.id, t.key)}
                      >
                        → {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
