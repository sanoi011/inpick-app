"use client";

import { useEffect, useState, useCallback } from "react";
import { X, CheckCircle2, AlertTriangle, Info } from "lucide-react";

export interface ToastItem {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message?: string;
  duration?: number;
  link?: string;
}

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertTriangle,
};

const STYLES = {
  info: "border-blue-200 bg-blue-50 text-blue-900",
  success: "border-green-200 bg-green-50 text-green-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-red-200 bg-red-50 text-red-900",
};

const ICON_STYLES = {
  info: "text-blue-500",
  success: "text-green-500",
  warning: "text-amber-500",
  error: "text-red-500",
};

// Global toast state
let listeners: Array<(toasts: ToastItem[]) => void> = [];
let toasts: ToastItem[] = [];

function emit() {
  listeners.forEach((fn) => fn([...toasts]));
}

export function toast(item: Omit<ToastItem, "id">) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  toasts = [...toasts, { ...item, id }];
  emit();
  const duration = item.duration ?? 5000;
  if (duration > 0) {
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
      emit();
    }, duration);
  }
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.push(setItems);
    return () => {
      listeners = listeners.filter((fn) => fn !== setItems);
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {items.map((item) => {
        const Icon = ICONS[item.type];
        return (
          <div
            key={item.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-lg animate-in slide-in-from-right ${STYLES[item.type]}`}
            style={{ animation: "slideIn 0.3s ease-out" }}
          >
            <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${ICON_STYLES[item.type]}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{item.title}</p>
              {item.message && (
                <p className="text-xs mt-0.5 opacity-80">{item.message}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(item.id)}
              className="shrink-0 opacity-50 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
