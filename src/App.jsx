import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

import Login from "./pages/Login";
import Kanban from "./pages/Kanban";
import History from "./pages/History";
import Costs from "./pages/Costs";

const TAB_KEY = "kanban_mvp_tab";

function allowedTabsByRole(role) {
  if (role === "admin") return ["kanban", "history", "costs"];
  if (role === "operario") return ["kanban", "history"];
  if (role === "cocinero") return ["kanban"];
  return ["kanban"];
}

export default function App() {
  const [session, setSession] = useState(null);

  const [profile, setProfile] = useState({
    role: null,
    location_id: null,
    loading: true,
    error: "",
  });

  const [tab, setTab] = useState(() => localStorage.getItem(TAB_KEY) || "kanban");

  const envMissing =
    !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load profile (role + location)
  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!session?.user?.id) {
        setProfile((p) => ({ ...p, role: null, location_id: null, loading: false, error: "" }));
        return;
      }

      setProfile((p) => ({ ...p, loading: true, error: "" }));

      try {
        const userId = session.user.id;

        const { data, error } = await supabase
          .from("location_users")
          .select("role, location_id")
          .eq("user_id", userId)
          .single();

        if (error) throw error;

        if (!cancelled) {
          setProfile({ role: data.role, location_id: data.location_id, loading: false, error: "" });
        }
      } catch (e) {
        if (!cancelled) {
          setProfile({
            role: null,
            location_id: null,
            loading: false,
            error: e?.message || "Error leyendo location_users",
          });
        }
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const tabs = useMemo(() => allowedTabsByRole(profile.role), [profile.role]);

  // Mantener tab estable: solo corregimos si es inválida
  useEffect(() => {
    if (!tabs.includes(tab)) {
      const next = tabs[0] || "kanban";
      setTab(next);
      localStorage.setItem(TAB_KEY, next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.role]); // intencional: NO dependemos de "tab" para no “rebotar” tabs

  const setTabSafe = (next) => {
    setTab(next);
    localStorage.setItem(TAB_KEY, next);
  };

  if (!session) return <Login />;

  if (envMissing) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h2 style={{ marginTop: 0 }}>Configuración incompleta</h2>
        <p>
          Faltan variables de entorno en Cloudflare Pages:
          <b> VITE_SUPABASE_URL</b> y <b>VITE_SUPABASE_ANON_KEY</b>.
        </p>
        <p>
          Setealas en <b>Production</b> y <b>Preview</b> y redeploy. (Si no, el login entra y
          después te queda “blanco”, exactamente lo que estás viendo.)
        </p>
        <button onClick={() => supabase.auth.signOut()}>Salir</button>
      </div>
    );
  }

  if (profile.loading) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <div>Cargando perfil...</div>
        <button style={{ marginTop: 12 }} onClick={() => supabase.auth.signOut()}>
          Salir
        </button>
      </div>
    );
  }

  if (profile.error) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h3 style={{ marginTop: 0 }}>Error</h3>
        <pre
          style={{
            background: "#fff3f3",
            border: "1px solid #ffd1d1",
            padding: 12,
            borderRadius: 10,
            whiteSpace: "pre-wrap",
          }}
        >
          {profile.error}
        </pre>
        <p style={{ opacity: 0.8 }}>
          Esto suele ser RLS bloqueando <code>location_users</code> o un usuario sin fila asignada.
        </p>
        <button onClick={() => supabase.auth.signOut()}>Salir</button>
      </div>
    );
  }

  const role = profile.role || "unknown";

  return (
    <div style={{ minHeight: "100vh", background: "#f6f8fb", fontFamily: "system-ui, sans-serif" }}>
      {/* Top bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "#ffffffcc",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid #e6eaf2",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "10px 14px",
            display: "flex",
            gap: 10,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <strong>Kanban MVP</strong>
            <span
              style={{
                fontSize: 12,
                padding: "2px 10px",
                borderRadius: 999,
                background: "#eef2ff",
                border: "1px solid #d9e0ff",
              }}
            >
              Rol: {role}
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {tabs.includes("kanban") && (
              <button
                onClick={() => setTabSafe("kanban")}
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: tab === "kanban" ? "1px solid #111827" : "1px solid #d6dbe6",
                  background: tab === "kanban" ? "#111827" : "#fff",
                  color: tab === "kanban" ? "#fff" : "#111827",
                  cursor: "pointer",
                }}
              >
                Kanban
              </button>
            )}

            {tabs.includes("history") && (
              <button
                onClick={() => setTabSafe("history")}
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: tab === "history" ? "1px solid #111827" : "1px solid #d6dbe6",
                  background: tab === "history" ? "#111827" : "#fff",
                  color: tab === "history" ? "#fff" : "#111827",
                  cursor: "pointer",
                }}
              >
                Historial
              </button>
            )}

            {tabs.includes("costs") && (
              <button
                onClick={() => setTabSafe("costs")}
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: tab === "costs" ? "1px solid #111827" : "1px solid #d6dbe6",
                  background: tab === "costs" ? "#111827" : "#fff",
                  color: tab === "costs" ? "#fff" : "#111827",
                  cursor: "pointer",
                }}
              >
                Costos
              </button>
            )}

            <button
              onClick={() => supabase.auth.signOut()}
              style={{
                marginLeft: 6,
                padding: "6px 12px",
                borderRadius: 10,
                border: "1px solid #111827",
                background: "#111827",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Salir
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 14 }}>
        {tab === "kanban" && (
          <Kanban role={role} locationId={profile.location_id} />
        )}

        {tab === "history" && tabs.includes("history") && (
          <History role={role} locationId={profile.location_id} />
        )}

        {tab === "costs" && tabs.includes("costs") && (
          <Costs role={role} locationId={profile.location_id} />
        )}
      </div>
    </div>
  );
}
