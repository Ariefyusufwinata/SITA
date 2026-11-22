import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { client, unwrap } from "@/lib/api";
import { fmtDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "./ui";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data } = useQuery({ queryKey: ["notifications"], queryFn: () => unwrap(client.api.notifications.$get()), refetchInterval: 8000 });
  const readAll = useMutation({ mutationFn: () => unwrap(client.api.notifications["read-all"].$post()), onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }) });
  const readOne = useMutation({ mutationFn: (id: string) => unwrap(client.api.notifications[":id"].read.$post({ param: { id } })), onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }) });

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => setOpen((o) => !o)} aria-label="Notifikasi">
        <Bell size={18} />
        {!!data?.unread && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-white">{data.unread}</span>}
      </Button>
      {open && (
        <div className="fixed sm:absolute inset-x-2 sm:inset-x-auto sm:right-0 top-16 sm:top-auto sm:mt-2 z-50 w-auto sm:w-80 md:w-96 rounded-lg border border-border bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-muted/30">
            <span className="text-sm font-semibold">Notifikasi</span>
            <button className="text-xs text-primary font-medium hover:underline" onClick={() => readAll.mutate()}>Tandai semua dibaca</button>
          </div>
          <ul className="max-h-[60vh] sm:max-h-96 overflow-y-auto divide-y divide-border">
            {data?.items.length === 0 && <li className="p-4 text-sm text-center text-muted-foreground">Belum ada notifikasi.</li>}
            {data?.items.map((n) => (
              <li key={n.id} className={cn("cursor-pointer px-4 py-3 text-sm transition-colors hover:bg-muted/50", !n.read && "bg-red-50/50")}
                onClick={() => { readOne.mutate(n.id); setOpen(false); nav({ to: n.eventType === "LOGBOOK_SUBMITTED" ? "/validasi" : "/logbook" }); }}>
                <div className="font-medium text-foreground">{n.title}</div>
                <div className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mt-0.5">{n.message}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{fmtDateTime(n.createdAt)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
