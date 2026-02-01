import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import Login from "./pages/Login";
import Kanban from "./pages/Kanban";

export default function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!session) return <Login />;

  return (
    <div>
      <div style={{ padding: 10, display: "flex", justifyContent: "space-between", fontFamily: "sans-serif" }}>
        <span>Logueado</span>
        <button onClick={() => supabase.auth.signOut()}>Salir</button>
      </div>
      <Kanban />
    </div>
  );
}
