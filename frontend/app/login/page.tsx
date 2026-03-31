"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { apiLogin, apiMe } from "../../lib/api";
import { setAuthToken } from "../../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("1234");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      const auth = await apiLogin(username, password);
      setAuthToken(auth.access_token);
      const me = await apiMe();
      setMsg(`Autenticado como ${me.user}`);
      router.push("/editorial");
    } catch (ex: any) {
      setErr(ex?.message || "Falha no login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto mt-8">
      <Card className="p-6 glass">
        <div className="text-2xl font-bold">Login Admin</div>
        <div className="text-sm text-slate-300/80 mt-1">
          Necessário para salvar briefings, exportar e limpar cache.
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <label className="block">
            <div className="text-xs text-slate-300/80 mb-2">Usuário</div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400/30"
            />
          </label>
          <label className="block">
            <div className="text-xs text-slate-300/80 mb-2">Senha</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400/30"
            />
          </label>
          <div className="flex gap-2 items-center">
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
            <Badge tone="warning">Troque credenciais no .env em produção</Badge>
          </div>
        </form>

        {msg ? <div className="mt-4 text-emerald-300 text-sm">{msg}</div> : null}
        {err ? <div className="mt-4 text-rose-300 text-sm">{err}</div> : null}
      </Card>
    </div>
  );
}

