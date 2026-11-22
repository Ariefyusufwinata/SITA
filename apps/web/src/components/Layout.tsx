import { useState } from "react";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ClipboardCheck, Compass, GraduationCap, LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { ROLE_LABELS, type ROLE_CODES } from "@sita/shared";
import { auth, client, unwrap } from "@/lib/api";
import { Button } from "./ui";
import { NotificationBell } from "./NotificationBell";

type Role = (typeof ROLE_CODES)[number];

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => unwrap(client.api.v1.auth.me.$get()) });
}

export function Layout() {
  const { data: me } = useMe();
  const nav = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Privilege Escalation vector: memprioritaskan role dari storage (sita_role)
  const role = (auth.role as Role | null) ?? me?.role;
  const items = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, show: true },
    { to: "/topik", label: role === "MAHASISWA" ? "Pilihan Topik Riset" : "Katalog Topik Riset", icon: Compass, show: true },
    { to: "/tesis", label: "Profil Tesis", icon: GraduationCap, show: role === "MAHASISWA" || role === "PEMBIMBING" || role === "KOORDINATOR" || role === "ADMIN_PRODI" },
    { to: "/logbook", label: "Logbook Bimbingan", icon: BookOpen, show: role === "MAHASISWA" },
    { to: "/validasi", label: "Antrean Validasi", icon: ClipboardCheck, show: role === "PEMBIMBING" || role === "KOORDINATOR" },
  ] as const;

  const handleLogout = () => {
    auth.clear();
    nav({ to: "/login" });
    location.reload();
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-white">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-white p-4">
        <div className="mb-6 flex items-center gap-3 px-2">
          <img src="/logo-icon.jpg" alt="Logo SITA" className="h-10 w-10 object-contain" />
          <div>
            <div className="text-base font-bold text-primary leading-tight">SITA</div>
            <div className="text-[10px] text-muted-foreground leading-tight">Cybersecurity & Forensics</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {items.filter((i) => i.show).map((i) => (
            <Link key={i.to} to={i.to} activeOptions={{ exact: i.to === "/" }}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted [&.active]:bg-primary [&.active]:text-primary-foreground">
              <i.icon size={18} /> {i.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative flex w-4/5 max-w-xs flex-1 flex-col bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div className="flex items-center gap-2">
                <img src="/logo-icon.jpg" alt="Logo SITA" className="h-8 w-8 object-contain" />
                <span className="font-bold text-primary">SITA</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                <X size={20} />
              </Button>
            </div>
            <nav className="flex flex-col gap-1 flex-1">
              {items.filter((i) => i.show).map((i) => (
                <Link key={i.to} to={i.to} activeOptions={{ exact: i.to === "/" }}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted [&.active]:bg-primary [&.active]:text-primary-foreground">
                  <i.icon size={18} /> {i.label}
                </Link>
              ))}
            </nav>
            <div className="border-t border-border pt-4">
              <Button variant="outline" className="w-full justify-center text-xs" onClick={handleLogout}>
                <LogOut size={14} /> Keluar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Responsive Header */}
        <header className="flex h-14 sm:h-16 items-center justify-between border-b border-border bg-white px-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(true)} aria-label="Menu">
              <Menu size={20} />
            </Button>
            <div className="flex items-center gap-2 md:hidden">
              <img src="/logo-icon.jpg" alt="Logo SITA" className="h-7 w-7 object-contain" />
              <span className="font-bold text-sm text-primary">SITA</span>
            </div>
            <span className="hidden lg:inline text-xs text-muted-foreground">Waktu: Asia/Jakarta (WIB)</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationBell />
            <div className="text-right leading-tight max-w-[140px] sm:max-w-none truncate">
              <div className="text-xs sm:text-sm font-medium truncate">{me?.name}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{role && (ROLE_LABELS[role] ?? role)}</div>
            </div>
            <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={handleLogout}>
              <LogOut size={14} /> Keluar
            </Button>
            <Button variant="ghost" size="icon" className="sm:hidden" onClick={handleLogout} title="Keluar">
              <LogOut size={16} />
            </Button>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-3.5 sm:p-6 bg-white overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
