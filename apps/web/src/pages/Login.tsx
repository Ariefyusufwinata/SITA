import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { auth, unwrap } from "@/lib/api";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/components/ui";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const users = useQuery({
    queryKey: ["dev-users"],
    queryFn: async () => {
      const res = await fetch("/api/v1/auth/dev-users");
      return res.json() as Promise<
        {
          id: string;
          name: string;
          username: string;
          email: string;
          defaultPassword?: string;
          nim: string | null;
          nip: string | null;
          roles: { code: any; label: string }[];
        }[]
      >;
    },
  });

  const devLogin = useMutation({
    mutationFn: async (v: { userId: string; role: any }) => {
      const res = await fetch("/api/v1/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal login");
      return data;
    },
    onSuccess: (r) => {
      auth.set(r.token, r.user.role);
      location.href = "/";
    },
  });

  const credentialLogin = useMutation({
    mutationFn: async (v: { username: string; password: string }) => {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal login");
      return data;
    },
    onSuccess: (r) => {
      auth.set(r.token, r.user.role);
      location.href = "/";
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-3 py-6 sm:px-6">
      <div className="mb-6 flex flex-col items-center text-center">
        <img src="/logo-horizontal.jpg" alt="Logo SITA" className="h-16 sm:h-24 w-auto max-w-full object-contain mb-3" />
        <h1 className="text-xl sm:text-2xl font-bold text-primary tracking-tight">SITA MSF</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Magister Cybersecurity & Digital Forensics — Telkom University</p>
        <p className="mt-2.5 inline-block rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] sm:text-xs text-amber-800 font-medium">
          Mode Lab Keamanan (Vulnerable Testing Lab) — Username & Password Sesuai Format Testing
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Quick Role Switcher */}
        <Card className="shadow-xs">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <CardTitle className="text-base sm:text-lg">Quick Role Switcher (1-Klik)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 p-4 sm:p-5 pt-2">
            {users.isLoading && <p className="text-xs sm:text-sm text-muted-foreground">Memuat akun…</p>}
            {users.error && <p className="text-xs sm:text-sm text-destructive">Gagal memuat akun. Pastikan API berjalan.</p>}
            {users.data?.map((u) => (
              <div key={u.id} className="rounded-lg border border-border p-3 bg-muted/20">
                <div className="text-sm font-semibold text-foreground">{u.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Username: <span className="font-mono text-primary font-semibold">{u.username}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Password: <span className="font-mono text-foreground">{u.defaultPassword}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2">
                  {u.roles.map((r) => (
                    <Button
                      key={r.code}
                      size="sm"
                      variant="outline"
                      className="text-xs h-7.5 px-2.5"
                      disabled={devLogin.isPending || credentialLogin.isPending}
                      onClick={() => devLogin.mutate({ userId: u.id, role: r.code })}
                    >
                      {r.label}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Login Form dengan Username & Password */}
        <Card className="shadow-xs h-fit">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <CardTitle className="text-base sm:text-lg">Login Akun</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-2">
            <form
              className="flex flex-col gap-3.5"
              onSubmit={(e) => {
                e.preventDefault();
                credentialLogin.mutate({ username, password });
              }}
            >
              <div>
                <Label className="text-xs sm:text-sm">Username</Label>
                <p className="text-[11px] text-muted-foreground mb-1">Tanpa titik, angka, atau karakter khusus</p>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z]/g, ""))}
                  placeholder="mis. andipratama"
                  required
                />
              </div>

              <div>
                <Label className="text-xs sm:text-sm">Password</Label>
                <Input
                  type="password"
                  className="mt-1"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="mis. andipratama@2231001"
                  required
                />
              </div>

              <Button type="submit" className="w-full mt-2" disabled={credentialLogin.isPending || devLogin.isPending}>
                {credentialLogin.isPending ? "Memproses…" : "Masuk"}
              </Button>
            </form>

            {credentialLogin.error && (
              <p className="mt-3 text-xs sm:text-sm text-destructive">{credentialLogin.error.message}</p>
            )}
            {devLogin.error && (
              <p className="mt-3 text-xs sm:text-sm text-destructive">{devLogin.error.message}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
