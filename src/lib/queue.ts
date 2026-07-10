// src/lib/queue.ts
import { Queue, QueueOptions } from "bullmq"; 
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL;

let rulesQueue: Queue | null = null;
let reportsQueue: Queue | null = null;
let backupQueue: Queue | null = null;

if (REDIS_URL) {
  try {
    const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
    rulesQueue = new Queue("rules-queue", {
      connection: connection as unknown as QueueOptions["connection"]
    });

    // New Reports Queue
    reportsQueue = new Queue("reports-queue", {
      connection: connection as unknown as QueueOptions["connection"]
    });

    backupQueue = new Queue("backup-queue", {
  connection: connection as unknown as QueueOptions["connection"]
});
    console.log("BullMQ Rules Queue initialized successfully.");

    // Register repeatable escalation job to run every 5 minutes
    rulesQueue.add("escalate-rules", {}, {
      repeat: {
        every: 5 * 60 * 1000, // 5 minutes
      },
      jobId: "escalate-rules-repeat" // Prevent duplicate schedulers
    }).then(() => {
      console.log("Repeatable rules escalation job scheduled successfully (5 min interval).");
    }).catch((err) => {
      console.error("Failed to schedule repeatable rules escalation job:", err);
    });

    backupQueue.add("daily-db-backup", {}, {
  repeat: {
    pattern: "0 0 * * *", // Runs every night at 12:00 AM
  },
  jobId: "daily-db-backup-repeat" // Prevents duplicate registrations in Redis
}).then(() => {
  console.log("Repeatable database backup job scheduled successfully (daily at 00:00).");
}).catch((err) => {
  console.error("Failed to schedule repeatable database backup job:", err);
});

  } catch (err) {
    console.warn("Failed to connect to Redis. Rules evaluation will fallback to synchronous run.");
  }
} else {
  console.log("No REDIS_URL found. Rules engine operating in synchronous fallback mode.");
}

export { rulesQueue, reportsQueue };
