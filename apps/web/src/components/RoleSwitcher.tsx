import { useState, useRef, useEffect } from "react";
import { ArrowLeftRight, Check, ChevronDown, ShieldCheck, Sparkles } from "lucide-react";
import { ROLE_LABELS, type ROLE_CODES } from "@sita/shared";
import { auth } from "@/lib/api";
import { useMe } from "./Layout";

type Role = (typeof ROLE_CODES)[number];

export function RoleSwitcher({ fullWidth }: { fullWidth?: boolean }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: me } = useMe();

  // Ambil peran aktif dan daftar peran langsung dari localStorage (sita_role)
  const activeRole = auth.role as Role;
  const localRoles = auth.roles as Role[];
  const hasMultipleRoles = localRoles.length > 1;

  // Tutup dropdown saat klik di luar
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

  // Fungsi switch role murni dari local storage (Vulnerable Testing Mode)
  const handleSwitchRole = (targetRole: Role) => {
    auth.setActiveRole(targetRole);
    setOpen(false);
    // Reload halaman agar seluruh loader, router guard, dan menu header membaca peran baru dari localStorage
    window.location.href = "/";
  };

  return (
    <div className={`relative ${fullWidth ? "w-full" : ""}`} ref={containerRef}>
      {/* Tombol Utama Switcher di Navbar */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={!hasMultipleRoles}
        className={`inline-flex items-center justify-between gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all shadow-2xs ${hasMultipleRoles
          ? "border-red-200 bg-red-50/90 text-red-900 hover:bg-red-100 hover:border-red-300 cursor-pointer"
          : "border-border bg-muted/40 text-muted-foreground cursor-default"
          } ${fullWidth ? "w-full" : ""} ${open ? "ring-2 ring-primary/20 border-primary" : ""}`}
        title={hasMultipleRoles ? "Klik untuk ganti peran aktif dari localStorage" : "Akun ini hanya memiliki 1 peran di localStorage"}
      >
        <div className="flex items-center gap-1.5 truncate">
          <span className="truncate">
            <strong className="text-primary font-bold">{ROLE_LABELS[activeRole] ?? activeRole}</strong>
          </span>
        </div>
        {hasMultipleRoles && (
          <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>

      {/* Popover Dropdown Switcher */}
      {open && hasMultipleRoles && (
        <div
          className={`absolute z-50 mt-2 rounded-xl border border-border bg-white shadow-xl overflow-hidden ${fullWidth ? "left-0 right-0 w-full" : "right-0 w-72 sm:w-80"
            }`}
        >

          {/* Daftar Role dari localStorage */}
          <div className="p-2 space-y-1">
            {localRoles.map((r) => {
              const isCurrent = r === activeRole;
              return (
                <button
                  key={r}
                  type="button"
                  disabled={isCurrent}
                  onClick={() => handleSwitchRole(r)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs transition-all ${isCurrent
                    ? "bg-primary text-white font-bold shadow-2xs"
                    : "hover:bg-muted text-foreground border border-transparent hover:border-border cursor-pointer font-medium"
                    }`}
                >
                  <div className="flex items-center gap-2">
                    {isCurrent ? (
                      <Check size={15} className="shrink-0 text-white" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-border shrink-0" />
                    )}
                    <span>{ROLE_LABELS[r] ?? r}</span>
                  </div>

                  {isCurrent ? (
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-semibold">Aktif</span>
                  ) : (
                    <span className="text-[11px] text-primary font-semibold hover:underline">Ganti</span>
                  )}
                </button>
              );
            })}
          </div>

        </div>
      )}
    </div>
  );
}
