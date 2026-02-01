import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

import Login from "./pages/Login";
import Kanban from "./pages/Kanban";
import History from "./pages/History";
import Costs from "./pages/Costs";

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // { role, location_id }
  const [view, setView] = useState("kanban");
  const [bootError, setBootError] = useState("");

  // 1) Sesión
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setProfile(null);
      setBootError("");
      setView("kanban");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // 2) Perfil (role/location) desde location_users
  useEffect(() => {
    const run = async () => {
      if (!session?.user?.id) return;

      const { data, error } = await supabase
        .from("location_users")
        .select("role, location_id")
        .eq("user_id", session.user.id)
        .single();

      if (error) {
        setBootError(`Error leyendo location_users: ${error.message}`);
        setProfile(null);
        return;
      }
      setProfile(data);
    };
    run();
  }, [session?.user?.id]);

  if (!session) return <Login />;
  if (bootError) return <div style={{ padding: 20, color: "crimson" }}>{bootError}</div>;
  if (!profile) return <div style={{ padding: 20 }}>Cargando perfil…</div>;

  const role = profile.role;
  const locationId = profile.location_id;

  const canSeeHistory = role === "admin"; // operario NO (según tu último pedido)
  const canSeeCosts = role === "admin";
  const canDoActions = role === "admin" || role === "operario"; // cocinero read-only

  // Si el usuario está en una vista no permitida, lo devolvemos a kanban
  useEffect(() => {
    if (view === "history" && !canSeeHistory) setView("kanban");
    if (view === "costs" && !canSeeCosts) setView("kanban");
  }, [view, canSeeHistory, canSeeCosts]);

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7fb" }}>
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: "1px solid #e5e7eb",
          background: "#ffffff",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <strong style={{ fontFamily: "system-ui" }}>Kanban MVP</strong>
          <span
            style={{
              fontSize: 12,
              background: "#eef2ff",
              border: "1px solid #c7d2fe",
              padding: "2px 8px",
              borderRadius: 999,
            }}
          >
            Rol: {role}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setView("kanban")}
            style={tabStyle(view === "kanban")}
          >
            Kanban
          </button>

          {canSeeHistory && (
            <button
              onClick={() => setView("history")}
              style={tabStyle(view === "history")}
            >
              Historial
            </button>
          )}

          {canSeeCosts && (
            <button
              onClick={() => setView("costs")}
              style={tabStyle(view === "costs")}
            >
              Costos
            </button>
          )}

          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "#111827",
              color: "white",
              cursor: "pointer",
            }}
          >
            Salir
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 14 }}>
        {view === "kanban" && (
          <Kanban role={role} locationId={locationId} canDoActions={canDoActions} />
        )}
        {view === "history" && <History role={role} locationId={locationId} />}
        {view === "costs" && <Costs locationId={locationId} />}
      </div>
    </div>
  );
}

function tabStyle(active) {
  return {
    padding: "8px 12px",
    borderRadius: 10,
    border: active ? "1px solid #111827" : "1px solid #e5e7eb",
    background: active ? "#111827" : "#ffffff",
    color: active ? "#ffffff" : "#111827",
    cursor: "pointer",
    fontWeight: 600,
  };
}
