import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import Login from "./pages/Login";
import Kanban from "./pages/Kanban";
import History from "./pages/History";
import UploadCosts from "./pages/UploadCosts";

const APP_BG = "#f6f7fb";
const CARD_BG = "#ffffff";
const TEXT = "#111827";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

const ROLE_ACTION_STATUSES = {
  operario: ["new", "ready", "dispatched"],
  cocinero: ["confirmed", "in_preparation"],
};

function Badge({ children }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        border: `1px solid ${BORDER}`,
        background: "#fff",
        fontSize: 12,
        color: TEXT,
      }}
    >
      {children}
    </span>
  );
}

function TabButton({ active, onClick, children, rightBadge }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 12px",
        borderRadius: 10,
        border: `1px solid ${active ? "#111827" : BORDER}`,
        background: active ? "#111827" : "#fff",
        color: active ? "#fff" : TEXT,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontWeight: 600,
      }}
    >
      {children}
      {typeof rightBadge === "number" && rightBadge > 0 && (
        <span
          style={{
            background: "#ef4444",
            color: "#fff",
            borderRadius: 999,
            padding: "2px 8px",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {rightBadge}
        </span>
      )}
    </button>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // { role, location_id }
  const [view, setView] = useState("kanban"); // kanban | history | costs | alerts
  const [topMsg, setTopMsg] = useState("");

  // Notificaciones (solo operario/cocinero)
  const [alerts, setAlerts] = useState([]);
  const alertsCount = alerts.length;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      setTopMsg("");
      setProfile(null);

      const { data: u, error: uErr } = await supabase.auth.getUser();
      if (uErr) {
        setTopMsg(uErr.message);
        return;
      }
      const user = u?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from("location_users")
        .select("role, location_id")
        .eq("user_id", user.id)
        .single();

      if (error) {
        setTopMsg(`No pude leer role/location: ${error.message}`);
        return;
      }
      setProfile(data);

      // si no es admin, no puede quedar parado en costs
      if (data.role !== "admin" && view === "costs") setView("kanban");
      // si es admin, ocultamos alerts
      if (data.role === "admin" && view === "alerts") setView("kanban");
    };

    if (session) loadProfile();
    else {
      setProfile(null);
      setView("kanban");
      setTopMsg("");
      setAlerts([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const canSeeAlerts = useMemo(() => {
    const r = profile?.role;
    return r === "operario" || r === "cocinero";
  }, [profile?.role]);

  // Cargar alertas cada 5s (silencioso)
  useEffect(() => {
    if (!session || !profile?.role) return;

    const role = profile.role;
    if (!(role === "operario" || role === "cocinero")) {
      setAlerts([]);
      return;
    }

    const loadAlerts = async () => {
      const statuses = ROLE_ACTION_STATUSES[role] ?? [];
      if (statuses.length === 0) {
        setAlerts([]);
        return;
      }

      let q = supabase
        .from("orders")
        .select("id,order_number,status,customer_name,channel,updated_at")
        .in("status", statuses)
        .order("updated_at", { ascending: false })
        .limit(30);

      if (profile?.location_id) q = q.eq("location_id", profile.location_id);

      const { data, error } = await q;
      if (error) return; // no “rompemos” el UX por alertas
      setAlerts(data ?? []);
    };

    loadAlerts();
    const t = setInterval(loadAlerts, 5000);
    return () => clearInterval(t);
  }, [session, profile?.role, profile?.location_id]);

  if (!session) return <Login />;

  return (
    <div style={{ minHeight: "100vh", background: APP_BG, color: TEXT }}>
      {/* Top bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: APP_BG,
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "14px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <TabButton active={view === "kanban"} onClick={() => setView("kanban")}>
              Kanban
            </TabButton>

            <TabButton active={view === "history"} onClick={() => setView("history")}>
              Historial
            </TabButton>

            {profile?.role === "admin" && (
              <TabButton active={view === "costs"} onClick={() => setView("costs")}>
                Costos
              </TabButton>
            )}

            {canSeeAlerts && (
              <TabButton
                active={view === "alerts"}
                onClick={() => setView("alerts")}
                rightBadge={alertsCount}
              >
                Notificaciones
              </TabButton>
            )}

            <Badge>Rol: <b>{profile?.role ?? "..."}</b></Badge>

            {topMsg && <span style={{ color: "#ef4444", fontSize: 13 }}>{topMsg}</span>}
          </div>

          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: `1px solid ${BORDER}`,
              background: CARD_BG,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Salir
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 14 }}>
        {view === "kanban" && <Kanban profile={profile} />}

        {view === "history" && <History profile={profile} />}

        {view === "costs" && profile?.role === "admin" && (
          <UploadCosts locationId={profile.location_id} />
        )}

        {view === "alerts" && canSeeAlerts && (
          <div
            style={{
              background: CARD_BG,
              border: `1px solid ${BORDER}`,
              borderRadius: 14,
              padding: 14,
              fontFamily: "sans-serif",
            }}
          >
            <h2 style={{ margin: "4px 0 10px 0" }}>Notificaciones</h2>
            <div style={{ color: MUTED, fontSize: 13, marginBottom: 10 }}>
              Pedidos que requieren acción del rol <b>{profile?.role}</b>.
            </div>

            {alertsCount === 0 ? (
              <div style={{ padding: 12, borderRadius: 12, border: `1px dashed ${BORDER}`, color: MUTED }}>
                No hay pendientes. Por ahora el negocio está sospechosamente ordenado.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {alerts.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      border: `1px solid ${BORDER}`,
                      borderRadius: 12,
                      padding: 12,
                      background: "#fff",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800 }}>#{a.order_number} — {a.customer_name}</div>
                      <div style={{ fontSize: 13, color: MUTED }}>
                        Estado: <b>{a.status}</b> • Canal: {a.channel}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: MUTED }}>
                      {new Date(a.updated_at).toLocaleString("es-AR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 12, color: MUTED, fontSize: 12 }}>
              Tip: cuando cambie el estado en Kanban, esta lista se actualiza sola (cada 5s).
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
