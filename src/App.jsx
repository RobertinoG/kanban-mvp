import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import Login from "./pages/Login";
import Kanban from "./pages/Kanban";
import UploadCosts from "./pages/UploadCosts"; // si todavía no lo tenés, comentá esta línea

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // { role, location_id }
  const [view, setView] = useState("kanban"); // "kanban" | "costs"
  const [topMsg, setTopMsg] = useState("");

  // 1) Mantener sesión
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  // 2) Cargar rol + location_id
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
    };

    if (session) loadProfile();
    else {
      setProfile(null);
      setView("kanban");
      setTopMsg("");
    }
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
          fontFamily: "sans-serif",
          borderBottom: "1px solid #eee",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => setView("kanban")}>Kanban</button>

          {profile?.role === "admin" && (
            <button onClick={() => setView("costs")}>Costos</button>
          )}

          <span style={{ opacity: 0.7 }}>
            Rol: <b>{profile?.role ?? "..."}</b>
          </span>

          {topMsg && <span style={{ color: "crimson" }}>{topMsg}</span>}
        </div>

        <button onClick={() => supabase.auth.signOut()}>Salir</button>
      </div>

      {view === "kanban" && <Kanban profile={profile} />}

      {view === "costs" && profile?.role === "admin" && (
        <UploadCosts locationId={profile.location_id} />
      )}
    </div>
  );
}
