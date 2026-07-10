// src/app/workers/backupWorker.ts
import { Worker, WorkerOptions } from "bullmq";
import IORedis from "ioredis";
import { spawn } from "child_process";
import { createGzip } from "zlib";
import { PassThrough } from "stream";
import { r2Client, R2_BUCKET_NAME } from "@/app/lib/r2";
import { Upload } from "@aws-sdk/lib-storage";

// Memory-safe streaming database backup function
export async function backupDatabaseToR2(): Promise<string> {
  if (process.env.MODE !== "production") return "";

  const dbUrl: string | undefined = process.env.DATABASE_URL || process.env.LOCAL_DATABASE_URL;
  if (!dbUrl) {
    throw new Error("No database URL connection string found in environment variables.");
  }
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME is not configured.");
  }

  console.log("[Backup Worker] Initiating database backup process...");

  // Spawns pg_dump client process
  const pgDump = spawn("pg_dump", [dbUrl]);
  const gzip = createGzip();
  const passThroughStream = new PassThrough();

  // Pipe stdout of pg_dump through gzip, and write the output into the pass-through stream
  pgDump.stdout.pipe(gzip).pipe(passThroughStream);

  // Capture process error outputs
  let stderrData = "";
  pgDump.stderr.on("data", (chunk: Buffer) => {
    stderrData += chunk.toString();
  });

  const dateObj = new Date();
  const yearStr = dateObj.getUTCFullYear().toString();
  const monthStr = (dateObj.getUTCMonth() + 1).toString().padStart(2, "0");
  const dayStr = dateObj.getUTCDate().toString().padStart(2, "0");
  const timestamp = dateObj.getTime();

  // Save with Hive-like partition structure for clean organization
  const storageKey = `backups/year=${yearStr}/month=${monthStr}/day=${dayStr}/db_backup_${timestamp}.sql.gz`;

  const uploader = new Upload({
    client: r2Client,
    params: {
      Bucket: R2_BUCKET_NAME,
      Key: storageKey,
      Body: passThroughStream,
      ContentType: "application/gzip",
    },
  });

  // Wait for the upload stream to finish and pg_dump to complete
  await Promise.all([
    uploader.done(),
    new Promise<void>((resolve, reject) => {
      pgDump.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`pg_dump process terminated with exit code ${code}. Error: ${stderrData}`));
        } else {
          resolve();
        }
      });
      pgDump.on("error", (err) => {
        reject(err);
      });
    }),
  ]);

  console.log(`[Backup Worker] Database backup successfully completed and stored at: ${storageKey}`);
  return storageKey;
}

// Start the worker instance if Redis is configured
const REDIS_URL = process.env.REDIS_URL;
if (REDIS_URL && process.env.MODE === "production") {
  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

  new Worker(
    "backup-queue",
    async (job) => {
      if (job.name === "daily-db-backup") {
        console.log(`[Worker] Executing repeatable backup job: ${job.id}`);
        await backupDatabaseToR2();
      }
    },
    {
      connection: connection as unknown as WorkerOptions["connection"],
    }
  );

  console.log("BullMQ DB Backup Worker running successfully on backup-queue.");
} else {
  console.warn("Backup worker not started: REDIS_URL environment variable is missing.");
}
