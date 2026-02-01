import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import Login from "./pages/Login";
import Kanban from "./pages/Kanban";
import History from "./pages/History";
import Costs from "./pages/Costs";

const TAB_LABEL = {
  kanban: "Kanban",
  history: "Historial",
  costs: "Costos",
};

function allowedTabs(role) {
  if (role === "admin") return ["kanban", "history", "costs"];
  if (role === "operario") return ["kanban", "history"];
  if (role === "cocinero") return ["kanban"];
  return ["kanban"];
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // { role, location_id }
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Tab persistente (para que el auto-refresh NO te saque de Historial)
  const [tab, setTab] = useState(() => localStorage.getItem("tab") || "kanban");
  useEffect(() => localStorage.setItem("tab", tab), [tab]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      setProfile(null);
      setLoadingProfile(true);

      const user = session?.user;
      if (!user) {
        setLoadingProfile(false);
        return;
      }

      const { data, error } = await supabase
        .from("location_users")
        .select("role, location_id")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Error leyendo location_users:", error);
        setProfile({ role: "unknown", location_id: null });
      } else {
        setProfile(data);
      }
      setLoadingProfile(false);
    };

    loadProfile();
  }, [session]);

  if (!session) return <Login />;

  if (loadingProfile || !profile) {
    return (
      <div className="container">
        <div className="card" style={{ padding: 14 }}>
          Cargando perfil...
        </div>
      </div>
    );
  }

  const tabs = useMemo(() => allowedTabs(profile.role), [profile.role]);

  // si el tab actual no está permitido, lo forzamos al primero permitido
  useEffect(() => {
    if (!tabs.includes(tab)) setTab(tabs[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.role]);

  return (
    <div className="container">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div className="brand">Kanban MVP</div>

          <div className="tabs">
            {tabs.map((t) => (
              <button
                key={t}
                className={`tabBtn ${tab === t ? "active" : ""}`}
                onClick={() => setTab(t)}
              >
                {TAB_LABEL[t]}
              </button>
            ))}
          </div>

          <span className="rolePill">Rol: {profile.role}</span>
        </div>

        <button className="btn" onClick={() => supabase.auth.signOut()}>
          Salir
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        {tab === "kanban" && (
          <Kanban role={profile.role} locationId={profile.location_id} />
        )}

        {tab === "history" && (
          <History role={profile.role} locationId={profile.location_id} />
        )}

        {tab === "costs" && (
          <Costs role={profile.role} locationId={profile.location_id} />
        )}
      </div>
    </div>
  );
}
