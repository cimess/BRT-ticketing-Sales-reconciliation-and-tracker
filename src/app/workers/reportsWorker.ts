// src/app/workers/reportsWorker.ts
import { Job, Worker, WorkerOptions } from "bullmq";
import IORedis from "ioredis";
import puppeteer from "puppeteer";
import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { r2Client, R2_BUCKET_NAME } from "@/app/lib/r2";
import { Upload } from "@aws-sdk/lib-storage";
import { broadcast } from "@/app/lib/sseEvent/sse";
import {cacheInvalidate} from "@/app/lib/redis";

// Define strict interfaces for job payloads
interface ReportJobData {
  taskId: string;
  companyId: string;
}

// Define strict types for the query aggregate rows
interface MonthlySalesRow {
  report_day: Date;
  _sum: {
    total_sold: Prisma.Decimal | number | null;
    commission_earned: Prisma.Decimal | number | null;
  };
}

interface FloatAllocationRow {
  allocated_at: Date;
  amount_allocated: Prisma.Decimal;
  status: string;
  supervisor: {
    first_name: string;
    last_name: string;
  };
}

interface LocationSalesRow {
  location_name: string;
  total_sold: number;
}

// Helper to format date into Hive Partitioning components
function getPartitionDateComponents(date: Date) {
  const year = date.getUTCFullYear().toString();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  return { year, month, day };
}

// Processor Function
async function processReportTask(job: Job<ReportJobData>): Promise<void> {
  const { taskId, companyId } = job.data;
  console.log(`[Worker] Starting report task execution: ${taskId}`);

  // 1. Retrieve report configurations
  const task = await prisma.reportTask.findUnique({
    where: { id: taskId }
  });


  const company = await prisma.company.findUnique({
    where: { id: companyId }
  });

  if (!company) throw new Error(`Company ID ${companyId} not found.`);  
  if (!task) throw new Error(`ReportTask ID ${taskId} not found.`);



  // Update status to RUNNING
  await prisma.reportTask.update({
    where: { id: taskId },
    data: { status: "RUNNING" }
  });

    // Invalidate the cache immediately before starting generation
  // This ensures that if a user refreshes during generation, they won't get stale data
  await cacheInvalidate(`cache:reports:${companyId}`);

  try {
    const start = new Date(task.period_start);
    const end = new Date(task.period_end);

    // 3. Structure R2 folder path with Hive Partitioning
    const { year, month, day } = getPartitionDateComponents(task.created_at);
    const filename = `report_${task.type.toLowerCase()}_${taskId}.${task.format.toLowerCase()}`;
    const storageKey = `reports/company_id=${companyId}/year=${year}/month=${month}/day=${day}/${filename}`;

    let fileBuffer: Buffer = Buffer.from("");
    const contentType = task.format === "PDF" ? "application/pdf" : "text/csv";

    // 2. Fetch dataset and compile format based on report type
    if (task.type === "MONTHLY_SALES") {
      const salesData = (await prisma.salesReport.groupBy({
        by: ["report_day"],
        where: {
          company_id: companyId,
          report_day: { gte: start, lte: end }
        },
        _sum: {
          total_sold: true,
          commission_earned: true
        },
        orderBy: {
          report_day: "asc"
        }
      })) as unknown as MonthlySalesRow[];

      if (task.format === "CSV") {
        let csvContent = "Date,Total Sold (NGN),Commission Earned (NGN)\n";
        salesData.forEach((row) => {
          const dateStr = new Date(row.report_day).toISOString().split("T")[0];
          csvContent += `"${dateStr}",${Number(row._sum.total_sold || 0)},${Number(row._sum.commission_earned || 0)}\n`;
        });
        fileBuffer = Buffer.from(csvContent, "utf-8");
      } else {
        let htmlRows = "";
        salesData.forEach((row) => {
          const dateStr = new Date(row.report_day).toISOString().split("T")[0];
          htmlRows += `<tr>
            <td style="padding: 10px; border-bottom: 1px solid #334155;">${dateStr}</td>
            <td style="padding: 10px; border-bottom: 1px solid #334155;">₦${Number(row._sum.total_sold || 0).toLocaleString()}</td>
            <td style="padding: 10px; border-bottom: 1px solid #334155;">₦${Number(row._sum.commission_earned || 0).toLocaleString()}</td>
          </tr>`;
        });
        fileBuffer = await renderHtmlToPdf(task.name, "MONTHLY_SALES", start, end, task.created_at, htmlRows,company?.name);
      }

    } else if (task.type === "MONTHLY_FLOAT") {
      const floatData = (await prisma.float_allocations.findMany({
        where: {
          company_id: companyId,
          allocated_at: { gte: start, lte: end }
        },
        include: {
          supervisor: { select: { first_name: true, last_name: true } }
        },
        orderBy: {
          allocated_at: "asc"
        }
      })) as unknown as FloatAllocationRow[];

      if (task.format === "CSV") {
        let csvContent = "Date Allocated,Supervisor,Amount (NGN),Status\n";
        floatData.forEach((row) => {
          const name = `${row.supervisor?.first_name || ""} ${row.supervisor?.last_name || ""}`.trim();
          csvContent += `"${new Date(row.allocated_at).toISOString()}","${name}",${Number(row.amount_allocated)},"${row.status}"\n`;
        });
        fileBuffer = Buffer.from(csvContent, "utf-8");
      } else {
        let htmlRows = "";
        floatData.forEach((row) => {
          const name = `${row.supervisor?.first_name || ""} ${row.supervisor?.last_name || ""}`.trim();
          htmlRows += `<tr>
            <td style="padding: 10px; border-bottom: 1px solid #334155;">${new Date(row.allocated_at).toLocaleDateString()}</td>
            <td style="padding: 10px; border-bottom: 1px solid #334155;">${name}</td>
            <td style="padding: 10px; border-bottom: 1px solid #334155;">₦${Number(row.amount_allocated).toLocaleString()}</td>
            <td style="padding: 10px; border-bottom: 1px solid #334155;">${row.status}</td>
          </tr>`;
        });
        fileBuffer = await renderHtmlToPdf(task.name, "MONTHLY_FLOAT", start, end, task.created_at, htmlRows,company?.name);
      }

    } else if (task.type === "LOCATION_SALES") {
      const rawLocationSales = await prisma.salesReport.groupBy({
        by: ["location_id"],
        where: {
          company_id: companyId,
          report_day: { gte: start, lte: end }
        },
        _sum: {
          total_sold: true
        },
        orderBy: {
          _sum: { total_sold: "desc" }
        }
      });

      // Join Location details in-memory
      const locationIds = rawLocationSales.map(r => r.location_id);
      const locations = await prisma.location.findMany({
        where: { id: { in: locationIds } }
      });
      const locationMap = new Map(locations.map(loc => [loc.id, loc.name]));

      const locationData: LocationSalesRow[] = rawLocationSales.map(item => ({
        location_name: locationMap.get(item.location_id) || "Unknown",
        total_sold: Number(item._sum.total_sold || 0)
      }));

      if (task.format === "CSV") {
        let csvContent = "Location,Total Tickets Sold (NGN)\n";
        locationData.forEach((row) => {
          csvContent += `"${row.location_name}",${row.total_sold}\n`;
        });
        fileBuffer = Buffer.from(csvContent, "utf-8");
      } else {
        let htmlRows = "";
        locationData.forEach((row) => {
          htmlRows += `<tr>
            <td style="padding: 10px; border-bottom: 1px solid #334155;">${row.location_name}</td>
            <td style="padding: 10px; border-bottom: 1px solid #334155;">₦${row.total_sold.toLocaleString()}</td>
          </tr>`;
        });
        fileBuffer = await renderHtmlToPdf(task.name, "LOCATION_SALES", start, end, task.created_at, htmlRows,company?.name);
      }
    }

    // 5. Upload file buffer directly to Cloudflare R2
    const upload = new Upload({
      client: r2Client,
      params: {
        Bucket: R2_BUCKET_NAME,
        Key: storageKey,
        Body: fileBuffer,
        ContentType: contentType
      }
    });
    await upload.done();

    // 6. Update database record to READY
    await prisma.reportTask.update({
      where: { id: taskId },
      data: {
        status: "READY",
        storage_key: storageKey,
        completed_at: new Date()
      }
    });

    // 8. Re-invalidate the cache so the next request fetches the new data
    await cacheInvalidate(`cache:reports:${companyId}`);

    console.log(`[Worker] Report task generated successfully: ${taskId}`);

    // 7. Broadcast SSE event to update client UI reactively
    broadcast("NOTIFICATION_CREATED", {
      message: `Your report "${task.name}" is now ready for download.`,
      type: "REPORT_READY",
      reference_id: taskId
    }, {
      userIds: [task.created_by_id]
    });
    return 

  } catch (error) {
    const err = error as Error;
    console.error(`[Worker] Report generation failed for task ${taskId}:`, err);

    // Update database record to FAILED
    await prisma.reportTask.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        error_message: err.message || "Unknown worker error"
      }
    });
    await cacheInvalidate(`cache:reports:${companyId}`);
  }
}



// Helper to render HTML and print PDF using Puppeteer
async function renderHtmlToPdf(
  taskName: string,
  taskType: string,
  start: Date,
  end: Date,
  createdAt: Date,
  tableRowsHtml: string,
  companyName?:string
): Promise<Buffer> {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: sans-serif; background-color: #0f172a; color: #f8fafc; margin: 40px; }
        h1 { color: #38bdf8; font-size: 24px; border-bottom: 2px solid #1e293b; padding-bottom: 10px; }
        .meta { margin-bottom: 30px; font-size: 12px; color: #94a3b8; }
        table { width: 100%; border-collapse: collapse; text-align: left; margin-top: 20px; }
        th { background-color: #1e293b; color: #38bdf8; padding: 12px; font-size: 13px; font-weight: bold; }
      </style>
    </head>
    <body>
      <h1> ${companyName} - ${taskName}</h1>
      <div class="meta">
        <p><strong>Report Type:</strong> ${taskType}</p>
        <p><strong>Period:</strong> ${start.toLocaleDateString()} to ${end.toLocaleDateString()}</p>
        <p><strong>Generated At:</strong> ${createdAt.toLocaleString()}</p>
      </div>
      <table>
        <thead>
          ${taskType === "MONTHLY_SALES" ? "<tr><th>Date</th><th>Total Sold</th><th>Commission Earned</th></tr>" : ""}
          ${taskType === "MONTHLY_FLOAT" ? "<tr><th>Date</th><th>Supervisor</th><th>Amount</th><th>Status</th></tr>" : ""}
          ${taskType === "LOCATION_SALES" ? "<tr><th>Location</th><th>Total Tickets Sold</th></tr>" : ""}
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    </body>
    </html>
  `;
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();
  
  // Fix 1: Use 'domcontentloaded' instead of 'networkidle0'
  await page.setContent(htmlContent, { waitUntil: "domcontentloaded" });
  
  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "40px", bottom: "40px", left: "30px", right: "30px" }
  });
  await browser.close();
  
  // Fix 2: Wrap Uint8Array in Buffer.from()
  return Buffer.from(pdfBuffer);
}

// Initialize the Worker process
const REDIS_URL = process.env.REDIS_URL;
if (REDIS_URL) {
  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  
  new Worker<ReportJobData>("reports-queue", async (job) => {
    console.log(`[Worker] Processing reports-queue job: ${job.id}`);
    await processReportTask(job);
  }, { 
    connection: connection as unknown as WorkerOptions["connection"] 
  });
  
  console.log("BullMQ Reports Worker running successfully on reports-queue.");
} else {
  console.warn("Worker not started: REDIS_URL environment variable is missing.");
}
