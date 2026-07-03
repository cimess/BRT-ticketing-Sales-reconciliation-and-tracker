// src/lib/queue.ts
import { Queue, QueueOptions } from "bullmq"; 
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL;

let rulesQueue: Queue | null = null;

if (REDIS_URL) {
  try {
    const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
    rulesQueue = new Queue("rules-queue", {
      connection: connection as unknown as QueueOptions["connection"]
    });
    console.log("BullMQ Rules Queue initialized successfully.");
  } catch (err) {
    console.warn("Failed to connect to Redis. Rules evaluation will fallback to synchronous run.");
  }
} else {
  console.log("No REDIS_URL found. Rules engine operating in synchronous fallback mode.");
}

export { rulesQueue };
