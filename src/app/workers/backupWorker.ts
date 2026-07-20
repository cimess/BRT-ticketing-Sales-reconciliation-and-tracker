// src/app/workers/backupWorker.ts
import { Worker, WorkerOptions } from "bullmq";
import IORedis from "ioredis";
import { spawn } from "child_process";
import { createGzip } from "zlib";
import { PassThrough } from "stream";
import { r2Client, R2_BUCKET_NAME } from "@/app/lib/r2";
import { Upload } from "@aws-sdk/lib-storage";
import { prisma } from "@/app/lib/prisma";

type DbRecord = Record<string, string | number | boolean | Date | null | undefined | object>;

interface PrismaModelDelegate {
  findMany: () => Promise<DbRecord[]>;
}

// Helper to convert DB records to CSV
function convertToCSV(data: DbRecord[]): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map(row => 
    headers.map(fieldName => {
      const val = row[fieldName];
      if (val === null || val === undefined) return '""';
      if (val instanceof Date) return `"${val.toISOString()}"`;
      const strVal = String(val).replace(/"/g, '""'); // Escape quotes
      return `"${strVal}"`;
    }).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

// 1. Export live database tables as CSV to R2
export async function exportTablesToR2(): Promise<void> {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME is not configured.");
  }

  const isProd = process.env.NODE_ENV === "production" || process.env.MODE === "production";
  const folder = isProd ? "db_exports" : "dev_db_exports";

  const tables: { name: string; model: PrismaModelDelegate }[] = [
    { name: "users", model: prisma.user as unknown as PrismaModelDelegate },
    { name: "sales_reports", model: prisma.salesReport as unknown as PrismaModelDelegate },
    { name: "float_allocations", model: prisma.float_allocations as unknown as PrismaModelDelegate },
    { name: "remittances", model: prisma.remittance as unknown as PrismaModelDelegate },
    { name: "pos_device_sessions", model: prisma.posDeviceSession as unknown as PrismaModelDelegate },
  ];

  console.log(`[Backup Worker] Initiating raw table exports to ${folder}...`);

  for (const table of tables) {
    try {
      console.log(`[Backup Worker] Exporting table "${table.name}"...`);
      const records = await table.model.findMany();
      const csvContent = convertToCSV(records);
      
      const upload = new Upload({
        client: r2Client,
        params: {
          Bucket: R2_BUCKET_NAME,
          Key: `${folder}/${table.name}.csv`,
          Body: Buffer.from(csvContent, "utf-8"),
          ContentType: "text/csv",
        },
      });
      await upload.done();
      console.log(`[Backup Worker] Exported and uploaded: ${folder}/${table.name}.csv`);
    } catch (err) {
      console.error(`[Backup Worker] Failed to export table "${table.name}":`, err);
    }
  }
}

// 2. Perform a standard database schema and data backup (pg_dump)
export async function backupDatabaseToR2(): Promise<string> {
  const dbUrl: string | undefined = process.env.DATABASE_URL || process.env.LOCAL_DATABASE_URL;
  if (!dbUrl) {
    throw new Error("No database URL connection string found in environment variables.");
  }
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME is not configured.");
  }

  const isProd = process.env.NODE_ENV === "production" || process.env.MODE === "production";
  const backupFolder = isProd ? "backups" : "dev_backups";

  console.log(`[Backup Worker] Initiating database backup process under ${backupFolder}...`);

  const pgDump = spawn("pg_dump", [dbUrl]);
  const gzip = createGzip();
  const passThroughStream = new PassThrough();

  pgDump.stdout.pipe(gzip).pipe(passThroughStream);

  let stderrData = "";
  pgDump.stderr.on("data", (chunk: Buffer) => {
    stderrData += chunk.toString();
  });

  const dateObj = new Date();
  const yearStr = dateObj.getUTCFullYear().toString();
  const monthStr = (dateObj.getUTCMonth() + 1).toString().padStart(2, "0");
  const dayStr = dateObj.getUTCDate().toString().padStart(2, "0");
  const timestamp = dateObj.getTime();

  const storageKey = `${backupFolder}/year=${yearStr}/month=${monthStr}/day=${dayStr}/db_backup_${timestamp}.sql.gz`;

  const uploader = new Upload({
    client: r2Client,
    params: {
      Bucket: R2_BUCKET_NAME,
      Key: storageKey,
      Body: passThroughStream,
      ContentType: "application/gzip",
    },
  });

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
if (REDIS_URL && (process.env.NODE_ENV === "production" || process.env.MODE === "production")) {
  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

  new Worker(
    "backup-queue",
    async (job) => {
      if (job.name === "daily-db-backup") {
        console.log(`[Worker] Executing repeatable backup job: ${job.id}`);
        await backupDatabaseToR2();
        await exportTablesToR2();
      }
    },
    {
      connection: connection as unknown as WorkerOptions["connection"],
    }
  );

  console.log("BullMQ DB Backup Worker running successfully on backup-queue.");
} else {
  console.warn("Backup worker not started: REDIS_URL environment variable is missing or environment is not production.");
}
