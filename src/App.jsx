import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import Login from "./pages/Login";
import Kanban from "./pages/Kanban";
import History from "./pages/History";
import Costs from "./pages/Costs";

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // { role, location_id }
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Tab persistente (no te patea al Kanban)
  const [tab, setTab] = useState(() => sessionStorage.getItem("tab") || "kanban");
  useEffect(() => sessionStorage.setItem("tab", tab), [tab]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!session?.user) {
        setProfile(null);
        setLoadingProfile(false);
        return;
      }
      setLoadingProfile(true);

      const { data, error } = await supabase
        .from("location_users")
        .select("role, location_id")
        .eq("user_id", session.user.id)
        .single();

      if (error) {
        console.error("Error leyendo location_users:", error);
        setProfile(null);
      } else {
        setProfile(data);
      }
      setLoadingProfile(false);
    };

    run();
  }, [session?.user?.id]);

  const role = profile?.role || null;
  const locationId = profile?.location_id || null;

  const allowedTabs = useMemo(() => {
    if (!role) return ["kanban"];
    if (role === "admin") return ["kanban", "history", "costs"];
    if (role === "operario") return ["kanban", "history"];
    // cocinero
    return ["kanban"];
  }, [role]);

  useEffect(() => {
    // Si quedaste en una tab no permitida (ej: cocinero), te llevo a kanban sin drama
    if (!allowedTabs.includes(tab)) setTab("kanban");
  }, [allowedTabs, tab]);

  if (!session) return <Login />;
  if (loadingProfile) return <div style={{ padding: 24 }}>Cargando perfil…</div>;
  if (!profile) return <div style={{ padding: 24, color: "crimson" }}>No se pudo cargar tu rol/location.</div>;

  const NavBtn = ({ id, label }) => {
    const active = tab === id;
    return (
      <button
        onClick={() => setTab(id)}
        style={{
          padding: "8px 12px",
          borderRadius: 10,
          border: "1px solid #d0d7de",
          background: active ? "#111827" : "#ffffff",
          color: active ? "#fff" : "#111827",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fb" }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "rgba(245,247,251,0.95)",
          backdropFilter: "blur(6px)",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 800 }}>Kanban MVP</div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {allowedTabs.includes("kanban") && <NavBtn id="kanban" label="Kanban" />}
              {allowedTabs.includes("history") && <NavBtn id="history" label="Historial" />}
              {allowedTabs.includes("costs") && <NavBtn id="costs" label="Costos" />}
            </div>

            <span
              style={{
                marginLeft: 6,
                fontSize: 12,
                padding: "4px 8px",
                borderRadius: 999,
                background: "#eef2ff",
                border: "1px solid #c7d2fe",
                color: "#3730a3",
                fontWeight: 700,
              }}
            >
              Rol: {role}
            </span>
          </div>

          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #d0d7de",
              background: "#111827",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Salir
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "16px" }}>
        {tab === "kanban" && (
          <Kanban role={role} locationId={locationId} active={tab === "kanban"} />
        )}
        {tab === "history" && (
          <History role={role} locationId={locationId} active={tab === "history"} />
        )}
        {tab === "costs" && (
          <Costs role={role} locationId={locationId} active={tab === "costs"} />
        )}
      </div>
    </div>
  );
}
