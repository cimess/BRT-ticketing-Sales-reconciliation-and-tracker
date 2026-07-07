"use client";
import { useEffect, useRef } from "react";
import { toast } from "react-toastify";

type EventHandler = (
  eventType: string,
  payload: unknown
) => void;

export function useEventStream(
  role: string,
  onEvent?: EventHandler
) {
  // Store the callback in a mutable ref to prevent effect cleanup on every render
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!role) return;

    const es = new EventSource(`/api/events`);

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { event: type, data } = msg;

     // Replace lines 24-55 of src/hooks/useEventStream.ts with:

        switch (type) {
          case "CONNECTED":
            console.log("Real-time SSE channel connected");
            break;

          case "NOTIFICATION_CREATED":
            toast.info(`🔔 ${data.message || "New notification received"}`);
            break;

          case "TOPUP_CREATED":
            toast.info(`💰 ${data.message || "New topup added"}`);
            break;

          case "SALE_CREATED":
            toast.info(`🧾 ${data.message || "New sale submitted"}`);
            break;
          
          case "FLOAT_UPDATED":
            toast.info(`💼 ${data.message || "Float updated"}`);
            break;

          case "REMITTANCE_CREATED":
            toast.info(`💸 ${data.message || "New remittance received"}`);
            break;
             case "REMITTANCE_ACCEPTED" : 
            toast.success(`💸 ${data.message || "New remittance accepted"}`);
            break;
             case "REMITTANCE_REJECTED":
            toast.error(`💸 ${data.message || "New remittance rejected"}`);
            break;
             case "REMITTANCE_REVERSED":
            toast.error(`💸 ${data.message || "New remittance reversed"}`);
            break;

          case "FINE_CREATED":
            toast.info(`🔔 ${data.message || "New fine issued"}`);
            break;

          case "FINE_ISSUED":
            toast.info(`🔔 ${data.message || "Fine issued"}`);
            break;

          case "SHORTAGE_CREATED":
            toast.error(`⚠️ ${data.message || "Shortage detected"}`);
            break;
        }


        onEventRef.current?.(type, data);

        // Dispatch a global event so UI panels can listen and auto-refresh listings
        window.dispatchEvent(new CustomEvent("sse", { detail: { type, data } }));
      } catch (err) {
        console.error("Error parsing incoming SSE event data:", err);
      }
    };

    es.onerror = (error) => {
      console.log("SSE disconnected. Reconnecting...", error);
    };

    return () => {
      es.close();
    };
  }, [role]);
}
