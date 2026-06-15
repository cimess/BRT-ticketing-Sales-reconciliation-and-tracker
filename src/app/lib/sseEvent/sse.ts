export type SystemEvent =
  | "TOPUP_CREATED"
  | "SALE_CREATED"
  | "REMITTANCE_CREATED"
  | "FINE_CREATED"
  | "FLOAT_UPDATED"
  | "SHORTAGE_CREATED"
  | "CONNECTED";

type Client = {
  controller: ReadableStreamDefaultController;
  role: string;
};

const clients = new Map<string, Set<Client>>();

export function addClient(role: string, controller: ReadableStreamDefaultController) {
  if (!clients.has(role)) {
    clients.set(role, new Set());
  }

  clients.get(role)!.add({ controller, role });
}

export function removeClient(role: string, controller: ReadableStreamDefaultController) {
  const set = clients.get(role);
  if (!set) return;

  for (const client of set) {
    if (client.controller === controller) {
      set.delete(client);
      break;
    }
  }
}

export function broadcast(
  event: SystemEvent,
  payload: unknown,
  targetRoles: string[] = []
) {
  const message = {
    event,
    data: payload,
    timestamp: Date.now(),
  };

  const encoded =
    `data: ${JSON.stringify(message)}\n\n`;

  const buffer = new TextEncoder().encode(encoded);

  const rolesToSend =
    targetRoles.length > 0
      ? targetRoles
      : Array.from(clients.keys());

  for (const role of rolesToSend) {
    const set = clients.get(role);
    if (!set) continue;

    for (const client of set) {
      try{
      client.controller.enqueue(buffer);
      }catch(error){
        console.error("Error en el envio del SSE", error)
        set.delete(client)
      }
    }
  }
}