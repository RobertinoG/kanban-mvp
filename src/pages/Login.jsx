import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) setMsg(error.message);
  };

  return (
    <div className="loginWrap">
      <div className="loginCard">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Kanban MVP</div>
            <div className="hint">Acceso interno (roles por sucursal)</div>
          </div>
          <span className="badge">DEV</span>
        </div>

        <form onSubmit={submit} style={{ marginTop: 14, display: "grid", gap: 10 }}>
          <input
            className="input"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
          <input
            className="input"
            placeholder="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          <button className="btn" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>

          {msg && <div style={{ color: "#b91c1c", fontWeight: 700, fontSize: 13 }}>{msg}</div>}
        </form>

        <div className="hint" style={{ marginTop: 10 }}>
          Tip: si te tira <b>JWT expired</b>, generá sesión de nuevo (cerrar y abrir, o loguear de nuevo).
        </div>
      </div>
    </div>
  );
}
