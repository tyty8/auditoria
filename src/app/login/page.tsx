"use client";
import React, { useState, FormEvent } from "react";
import { Brand } from "@/components/topbar";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = "/";
      } else {
        setError("Contraseña incorrecta.");
        setPassword("");
      }
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Brand size={32} />
        </div>
        <div className="card" style={{ padding: "32px 28px" }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, letterSpacing: "-.02em" }}>Acceso de administrador</h1>
          <p style={{ fontSize: 13.5, color: "var(--ink-3)", marginBottom: 24, lineHeight: 1.5 }}>
            Introduce la contraseña para continuar.
          </p>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label className="field-label">Contraseña</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoFocus
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p style={{ fontSize: 13, color: "var(--bad)", fontWeight: 600, margin: 0 }}>{error}</p>
            )}
            <button
              type="submit"
              className="btn btn-lg btn-block"
              disabled={loading || !password}
              style={{ background: "var(--primary)", color: "#fff", border: "none", fontWeight: 700 }}
            >
              {loading ? "Verificando…" : "Entrar"}
            </button>
          </form>
        </div>
        <p style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "var(--ink-4)" }}>
          Configura <code>ADMIN_PASSWORD</code> y <code>ADMIN_SECRET</code> en las variables de entorno.
        </p>
      </div>
    </div>
  );
}
