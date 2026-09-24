"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/utils/cn";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  duration: number;
}

interface ToastApi {
  toast: (message: string, kind?: ToastKind, durationMs?: number) => void;
}

const ToastContext = createContext<ToastApi>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const icons: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-emerald-400" aria-hidden />,
  error: <AlertTriangle className="h-5 w-5 text-crimson-400" aria-hidden />,
  info: <Info className="h-5 w-5 text-primary-300" aria-hidden />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "info", durationMs = 4200) => {
      const id = nextId.current++;
      setItems((prev) => [...prev.slice(-3), { id, kind, message, duration: durationMs }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), durationMs)
      );
    },
    [dismiss]
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const t of map.values()) clearTimeout(t);
      map.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="pointer-events-none fixed bottom-20 left-1/2 z-[90] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4 sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0 sm:items-end"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className="glass-strong pointer-events-auto flex w-full items-center gap-3 rounded-2xl px-4 py-3 shadow-card-lg"
            style={{ animation: "kuro-toast-in 0.28s cubic-bezier(0.21,1.02,0.73,1) both" }}
          >
            {icons[t.kind]}
            <p className="flex-1 text-sm font-medium leading-snug text-txt">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="rounded-lg p-1 text-txt-faint transition-colors hover:bg-white/5 hover:text-txt"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
