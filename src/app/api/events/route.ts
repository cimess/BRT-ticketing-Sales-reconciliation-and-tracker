// import { addClient, removeClient } from "@/lib/sseEvent/sse";

// export async function GET(req: Request) {
//   const { searchParams } = new URL(req.url);
//   const role = searchParams.get("role") || "USER";

//   const stream = new ReadableStream({
//     start(controller) {
//       addClient(role, controller);

//       controller.enqueue(
//         new TextEncoder().encode(
//           `data: ${JSON.stringify({ event: "CONNECTED" })}\n\n`
//         )
//       );

//       req.signal.addEventListener("abort", () => {
//         console.log("Client disconnected");
//         removeClient(role, controller);
//       });
//     },

//     cancel(controller) {
//       removeClient(role, controller);
//     },
//   });

//   return new Response(stream, {
//     headers: {
//       "Content-Type": "text/event-stream",
//       "Cache-Control": "no-cache",
//       Connection: "keep-alive",
//     },
//   });
// }