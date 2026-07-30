"use client";

import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { useEventStream } from "@/hooks/useEventStream";

// Replaced 'any' with 'unknown' for type safety
type SseEvent = { type: string; data: unknown };
type Listener = (e: SseEvent) => void;

const SseContext = createContext<{
  subscribe: (l: Listener) => () => void;
  lastEvent?: SseEvent;
} | null>(null);

export function SseProvider({ role, children }: { role: string; children: React.ReactNode }) {
  const listeners = useRef<Set<Listener>>(new Set());
  const [lastEvent, setLastEvent] = useState<SseEvent | undefined>(undefined);

  const emit = useCallback((type: string, data: unknown) => {
    const ev = { type, data };
    setLastEvent(ev);
    listeners.current.forEach((l) => l(ev));
  }, []);

  // Pass 'emit' directly. Since it is memoized with useCallback, its reference is completely stable.
  useEventStream(role, emit);

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
