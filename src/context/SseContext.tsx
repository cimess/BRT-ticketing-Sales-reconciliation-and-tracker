"use client";

import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { useEventStream } from "@/hooks/useEventStream";

type SseEvent = { type: string; data: any };
type Listener = (e: SseEvent) => void;

const SseContext = createContext<{
  subscribe: (l: Listener) => () => void;
  lastEvent?: SseEvent;
} | null>(null);

export function SseProvider({ role, children }: { role: string; children: React.ReactNode }) {
  const listeners = useRef<Set<Listener>>(new Set());
  const [lastEvent, setLastEvent] = useState<SseEvent | undefined>(undefined);

  const emit = useCallback((type: string, data: any) => {
    const ev = { type, data };
    setLastEvent(ev);
    listeners.current.forEach((l) => l(ev));
  }, []);

  useEventStream(role, (type, data) => {
    emit(type, data);
  });

  const subscribe = useCallback((l: Listener) => {
    listeners.current.add(l);
    return () => listeners.current.delete(l);
  }, []);

  return (
    <SseContext.Provider value={{ subscribe, lastEvent }}>{children}</SseContext.Provider>
  );
}

export function useSse() {
  const ctx = useContext(SseContext);
  if (!ctx) throw new Error("useSse must be used within SseProvider");
  return ctx;
}
