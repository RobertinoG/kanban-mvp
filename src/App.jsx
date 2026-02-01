import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import Login from "./pages/Login";
import Kanban from "./pages/Kanban";
import History from "./pages/History";
import UploadCosts from "./pages/UploadCosts"; // si no existe aún, comentá esta línea

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // { role, location_id }
  const [view, setView] = useState("kanban"); // "kanban" | "history" | "costs"
  const [topMsg, setTopMsg] = useState("");

  // Mantener sesión
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Cargar rol + location_id
  useEffect(() => {
    const loadProfile = async () => {
      setTopMsg("");
      setProfile(null);

      const { data: u, error: uErr } = await supabase.auth.getUser();
      if (uErr) {
        console.log("Error getUser:", uErr);
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
        console.log("Error leyendo location_users:", error);
        setTopMsg(`No pude leer role/location: ${error.message}`);
        return;
      }
      setProfile(data);

      // Si estás en "costs" pero no sos admin, te mando a kanban
      if (data.role !== "admin" && view === "costs") setView("kanban");
    };

    if (session) loadProfile();
    else {
      setProfile(null);
      setView("kanban");
      setTopMsg("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (!session) return <Login />;

  return (
    <div>
      <div
        style={{
          padding: 10,
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          fontFamily: "sans-serif",
          borderBottom: "1px solid #eee",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => setView("kanban")}>Kanban</button>
          <button onClick={() => setView("history")}>Historial</button>
          {profile?.role === "admin" && <button onClick={() => setView("costs")}>Costos</button>}

          <span style={{ opacity: 0.7 }}>
            Rol: <b>{profile?.role ?? "..."}</b>
          </span>

          {topMsg && <span style={{ color: "crimson" }}>{topMsg}</span>}
        </div>

        <button onClick={() => supabase.auth.signOut()}>Salir</button>
      </div>

      {view === "kanban" && <Kanban profile={profile} />}
      {view === "history" && <History profile={profile} />}

      {view === "costs" && profile?.role === "admin" && (
        <UploadCosts locationId={profile.location_id} />
      )}
    </div>
  );
}
