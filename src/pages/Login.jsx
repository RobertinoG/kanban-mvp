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
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f6f8fb",
        fontFamily: "system-ui, sans-serif",
        padding: 16,
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          border: "1px solid #e6eaf2",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 10px 30px rgba(16,24,40,.08)",
        }}
      >
        <h2 style={{ margin: 0 }}>Kanban MVP</h2>
        <p style={{ marginTop: 8, opacity: 0.7 }}>
          Ingresá con tu usuario. (Tranquilo, esto es un MVP, no un banco… todavía.)
        </p>

        <label style={{ display: "block", marginTop: 12, fontSize: 13, opacity: 0.8 }}>
          Email
        </label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@tulocal.com"
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #d6dbe6",
            outline: "none",
          }}
        />

        <label style={{ display: "block", marginTop: 12, fontSize: 13, opacity: 0.8 }}>
          Password
        </label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="••••••••"
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #d6dbe6",
            outline: "none",
          }}
        />

        <button
          disabled={loading}
          style={{
            marginTop: 14,
            width: "100%",
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #111827",
            background: "#111827",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>

        {msg && (
          <div
            style={{
              marginTop: 12,
              background: "#fff3f3",
              border: "1px solid #ffd1d1",
              padding: 10,
              borderRadius: 12,
              color: "#b42318",
              fontSize: 13,
            }}
          >
            {msg}
          </div>
        )}
      </form>
    </div>
  );
}
