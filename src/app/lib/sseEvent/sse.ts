// src/app/lib/sseEvent/sse.ts
import { EventEmitter } from "node:events";

export type SystemEvent =
  | "TOPUP_CREATED"
  | "SALE_CREATED"
  | "REMITTANCE_CREATED"
  | "FINE_CREATED"
  | "FLOAT_UPDATED"
  | "SHORTAGE_CREATED"
  | "NOTIFICATION_CREATED"
  | "CONNECTED";

// 1. Singleton EventEmitter on globalThis
const globalForSse = globalThis as unknown as {
  sseEventBus: EventEmitter | undefined;
};

if (!globalForSse.sseEventBus) {
  globalForSse.sseEventBus = new EventEmitter();
  globalForSse.sseEventBus.setMaxListeners(200); // Allow many concurrent SSE clients
}

export const eventBus = globalForSse.sseEventBus;

// 2. Broadcast function — emits an event on the bus (used by API routes / notification service)
export function broadcast(
  event: SystemEvent,
  payload: unknown,
  target?: { userIds?: string[]; roles?: string[] }
) {
  const message = {
    event,
    data: payload,
    timestamp: Date.now(),
  };

  eventBus.emit("sse-broadcast", { message, target });
}
