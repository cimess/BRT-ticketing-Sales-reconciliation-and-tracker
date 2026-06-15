// import {
//   addClient,
//   removeClient
// } from "@/lib/sseEvent/sse";

// export async function GET() {
//   const stream = new ReadableStream({
//     start(controller) {
//       addClient(controller);

//       controller.enqueue(
//         new TextEncoder().encode(
//           "data: connected\n\n"
//         )
//       );
//     },

//     cancel(controller) {
//       removeClient(controller);
//     }
//   });

//   return new Response(stream, {
//     headers: {
//       "Content-Type": "text/event-stream",
//       "Cache-Control": "no-cache",
//       Connection: "keep-alive"
//     }
//   });
// }