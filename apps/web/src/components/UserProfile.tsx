import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, LogOut, Shield } from "lucide-react";
import { ROLE_LABELS, type ROLE_CODES } from "@sita/shared";
import { auth } from "@/lib/api";
import { useMe } from "./Layout";
import { Button } from "./ui";

type Role = (typeof ROLE_CODES)[number];

function getInitials(name?: string) {
  if (!name) return "U";
  const clean = name.replace(/^(Dr\.|Prof\.|Ir\.|Drs\.|H\.|Hj\.)\s*/gi, "").replace(/,.*$/, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserProfile({ onLogout }: { onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: me } = useMe();
  const activeRole = (auth.role as Role | null) ?? me?.role;
  const localRoles = (auth.roles as Role[]) || [];
  const initials = getInitials(me?.name);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const handleSwitchRole = (targetRole: Role) => {
    if (targetRole === activeRole) return;
    auth.setActiveRole(targetRole);
    setOpen(false);
    window.location.href = "/";
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Profil Trigger Button di Navbar */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-lg border border-border/80 bg-white p-1 sm:px-2.5 sm:py-1.5 hover:bg-muted/50 hover:border-border transition-all cursor-pointer shadow-2xs ${open ? "ring-2 ring-primary/20 border-primary" : ""
          }`}
        title="Klik untuk membuka menu profil & ganti peran"
      >
        <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs sm:text-sm">
          {initials}
        </div>
        <div className="hidden sm:flex flex-col text-left leading-tight max-w-[130px] lg:max-w-[160px]">
          <span className="text-xs font-semibold text-foreground truncate">{me?.name ?? "Pengguna"}</span>
          <span className="text-[10px] text-muted-foreground truncate font-medium">{activeRole ? (ROLE_LABELS[activeRole] ?? activeRole) : "—"}</span>
        </div>
        <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Popover Dropdown Profil & Clickable Roles */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-xl border border-border bg-white p-4 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Header Profil */}
          <div className="flex items-center gap-3 pb-3 border-b border-border/70">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-xs">
              {initials}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="text-sm font-bold text-foreground truncate" title={me?.name}>
                {me?.name ?? "Pengguna"}
              </div>
              <div className="text-xs text-muted-foreground truncate" title={me?.email ?? (me?.nim ? `NIM: ${me.nim}` : me?.nip ? `NIP: ${me.nip}` : "user@sita.ac.id")}>
                {me?.email ?? (me?.nim ? `NIM: ${me.nim}` : me?.nip ? `NIP: ${me.nip}` : "user@sita.ac.id")}
              </div>
            </div>
          </div>

          {/* Bagian Peran yang Bisa Diklik (Clickable Roles) */}
          <div className="py-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Shield size={13} className="text-primary" /> Peran Akun
              </span>
            </div>

            <div className="space-y-1 max-h-52 overflow-y-auto pr-0.5">
              {localRoles.map((r) => {
                const isCurrent = r === activeRole;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleSwitchRole(r)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-all ${isCurrent
                      ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                      : "hover:bg-muted text-foreground border border-transparent hover:border-border cursor-pointer font-medium"
                      }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {isCurrent ? (
                        <Check size={14} className="shrink-0 text-primary-foreground" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-border shrink-0" />
                      )}
                      <span className="truncate">{ROLE_LABELS[r] ?? r}</span>
                    </div>

                    {isCurrent ? (
                      <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-semibold shrink-0">Aktif</span>
                    ) : (
                      <span className="text-[11px] text-primary font-semibold hover:underline shrink-0">Pilih</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tombol Keluar Merah Mencolok di Bawah */}
          <div className="pt-2.5 border-t border-border/70">
            <Button
              variant="destructive"
              className="w-full justify-center gap-2 text-xs font-semibold bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-sm cursor-pointer py-2 rounded-lg transition-colors"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
            >
              <LogOut size={14} /> Keluar dari Akun
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
