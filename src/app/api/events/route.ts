// src/app/api/events/route.ts
import { auth } from "@/auth";
import { eventBus,type SystemEvent } from "@/app/lib/sseEvent/sse";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const userId = session.user.id;
    const role = session.user.role;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        // 1. Define the listener for SSE broadcasts
        const onBroadcast = ({ message, target }: { message: SystemEvent ;target?: { userIds?: string[]; roles?: string[] } }) => {
          let shouldSend = false;

          if (!target) {
            shouldSend = true;
          } else {
            if (target.userIds && target.userIds.includes(userId)) {
              shouldSend = true;
            }
            if (target.roles && target.roles.includes(role)) {
              shouldSend = true;
            }
          }

          if (shouldSend) {
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(message)}\n\n`)
              );
            } catch (error) {
              console.error(`[SSE] Enqueue failed for user ${userId}. Cleaning up.`, error);
              eventBus.off("sse-broadcast", onBroadcast);
            }
          }
        };

        // 2. Subscribe to the global event bus
        eventBus.on("sse-broadcast", onBroadcast);
        console.log(`[SSE] Client connected: ${userId} (${role})`);

        // 3. Send confirmation ping
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ event: "CONNECTED" })}\n\n`
          )
        );

        // 4. Handle client disconnect — clean up listener
        req.signal.addEventListener("abort", () => {
          eventBus.off("sse-broadcast", onBroadcast);
          console.log(`[SSE] Client disconnected: ${userId}`);
        });
      },

      cancel() {
        // Fallback cleanup if ReadableStream is cancelled
        console.log(`[SSE] Stream cancelled for user ${userId}`);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("SSE stream route error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
