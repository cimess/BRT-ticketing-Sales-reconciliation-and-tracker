// "use client";

// import { useEffect } from "react";
// import { toast } from "react-toastify";

// type EventHandler = (
//   eventType: string,
//   payload: unknown
// ) => void;

// export function useEventStream(
//   role: string,
//   onEvent?: EventHandler
// ) {
//   useEffect(() => {
//     const es = new EventSource(
//       `/api/events?role=${role}`
//     );

//     es.onmessage = (event) => {
//       const msg = JSON.parse(event.data);

//       const { event: type, data } = msg;

//       switch (type) {
//         case "CONNECTED":
//           console.log("SSE connected");
//           break;

//         case "TOPUP_CREATED":
//           toast.info("💰 New topup added");
//           break;

//         case "SALE_CREATED":
//           toast.info("🧾 New sale submitted");
//           break;

//         case "REMITTANCE_CREATED":
//           toast.info("💸 New remittance received");
//           break;

//         case "SHORTAGE_CREATED":
//           toast.error("⚠️ Shortage detected");
//           break;
//       }

//       onEvent?.(type, data);
//       try {
//         window.dispatchEvent(new CustomEvent("sse", { detail: { type, data } }));
//       } catch (e) {
//         // ignore if dispatch fails in unexpected environments
//       }
//     };

//     es.onerror = () => {
//       console.log("SSE disconnected");
//     };

//     return () => es.close();
//   }, [role, onEvent]);
// }