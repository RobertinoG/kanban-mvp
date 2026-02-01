import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

import Login from "./pages/Login";
import Kanban from "./pages/Kanban";
import History from "./pages/History";
import UploadCosts from "./pages/UploadCosts";

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // { role, location_id }
  const [tab, setTab] = useState("kanban");
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [err, setErr] = useState("");

  // CSS global para matar el "gris a la derecha" + fondo claro uniforme
  const GlobalStyle = useMemo(
    () => (
      <style>{`
        html, body, #root { height: 100%; width: 100%; }
        body { margin: 0; background: #f6f7fb; color: #0f172a; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; }
        * { box-sizing: border-box; }
        button { cursor: pointer; }
      `}</style>
    ),
    []
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setProfile(null);
      setErr("");
      setTab("kanban");
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Cargar role/location del usuario logueado (location_users)
  useEffect(() => {
    const loadProfile = async () => {
      setErr("");
      if (!session?.user) return;

      setLoadingProfile(true);
      const userId = session.user.id;

      const { data, error } = await supabase
        .from("location_users")
        .select("role, location_id")
        .eq("user_id", userId)
        .single();

      if (error) {
        setErr(`Error leyendo location_users: ${error.message}`);
        setProfile(null);
      } else {
        setProfile(data);
      }
      setLoadingProfile(false);
    };

    loadProfile();
  }, [session]);

  const role = profile?.role ?? "";
  const locationId = profile?.location_id ?? "";

  const canSeeHistory = role === "admin" || role === "operario";
  const canSeeCosts = role === "admin";

  // Evita que el cocinero se quede en tabs que no le corresponden
  useEffect(() => {
    if (tab === "history" && !canSeeHistory) setTab("kanban");
    if (tab === "costs" && !canSeeCosts) setTab("kanban");
  }, [tab, canSeeHistory, canSeeCosts]);

  if (!session) {
    return (
      <>
        {GlobalStyle}
        <Login />
      </>
    );
  }

  return (
    <>
      {GlobalStyle}

      <div style={{ minHeight: "100vh", width: "100vw" }}>
        {/* Topbar */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "#ffffff",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              maxWidth: 1400,
              margin: "0 auto",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <strong style={{ letterSpacing: 0.2 }}>Kanban MVP</strong>

              <div style={{ display: "flex", gap: 8 }}>
                <TabBtn active={tab === "kanban"} onClick={() => setTab("kanban")}>
                  Kanban
                </TabBtn>

                {canSeeHistory && (
                  <TabBtn active={tab === "history"} onClick={() => setTab("history")}>
                    Historial
                  </TabBtn>
                )}

                {canSeeCosts && (
                  <TabBtn active={tab === "costs"} onClick={() => setTab("costs")}>
                    Costos
                  </TabBtn>
                )}
              </div>

              <span
                style={{
                  fontSize: 12,
                  padding: "4px 8px",
                  borderRadius: 999,
                  background: "#f1f5f9",
                  border: "1px solid #e2e8f0",
                  color: "#334155",
                }}
              >
                Rol: <b>{role || (loadingProfile ? "cargando..." : "sin rol")}</b>
              </span>

              {err && (
                <span style={{ fontSize: 12, color: "#b91c1c" }}>
                  {err}
                </span>
              )}
            </div>

            <button
              onClick={() => supabase.auth.signOut()}
              style={{
                border: "1px solid #e5e7eb",
                background: "#0f172a",
                color: "white",
                padding: "8px 12px",
                borderRadius: 10,
                fontWeight: 600,
              }}
            >
              Salir
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "14px" }}>
          {!profile ? (
            <div
              style={{
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                padding: 16,
              }}
            >
              Cargando perfil…
            </div>
          ) : (
            <>
              {tab === "kanban" && <Kanban role={role} locationId={locationId} />}
              {tab === "history" && canSeeHistory && <History role={role} locationId={locationId} />}
              {tab === "costs" && canSeeCosts && <Costs role={role} locationId={locationId} />}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: active ? "1px solid #0f172a" : "1px solid #e5e7eb",
        background: active ? "#0f172a" : "#ffffff",
        color: active ? "white" : "#0f172a",
        padding: "8px 12px",
        borderRadius: 10,
        fontWeight: 700,
        fontSize: 13,
      }}
    >
      {children}
    </button>
  );
}
