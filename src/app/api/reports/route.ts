// src/app/api/reports/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/app/lib/prisma";
import { reportsQueue } from "@/lib/queue";
import "@/app/workers/reportsWorker";
import "@/app/workers/backupWorker";
import { cacheGet, cacheSet, cacheInvalidate } from "@/app/lib/redis";


// GET /api/reports - Fetch all reports generated for the user's company
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { company_id } = session.user;

       // 1. Dynamic Cache Key for the company
    const cacheKey = `cache:reports:${company_id}`;
    
    // 2. Try cache first
    const cachedReports = await cacheGet(cacheKey);
    if (cachedReports) {
      return NextResponse.json(cachedReports);
    }

    const reports = await prisma.reportTask.findMany({
      where: { company_id },
      orderBy: { created_at: "desc" },
      include: {
        created_by: {
          select: { first_name: true, last_name: true, email: true }
        }
      },
      take:100
    });

    // 4. Cache the result before returning
    const responsePayload = { success: true, data: reports };
    await cacheSet(cacheKey, responsePayload, 60); // 1 min TTL
    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("GET /api/reports error:", error);
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
}

// POST /api/reports - Trigger async report generation
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { company_id, id: userId, role } = session.user;

    // Restrict report generation to higher privilege roles
    if (role !== "ADMIN" && role !== "SUPERVISOR" && role !== "AUDITOR") {
      return NextResponse.json({ error: "Forbidden: Not authorized" }, { status: 403 });
    }

    const body = await req.json();
    const { name, type, period_start, period_end, format } = body;

    // Validate core parameters
    if (!name || !type || !period_start || !period_end || !format) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Insert Task in Database (PENDING)
    const task = await prisma.reportTask.create({
      data: {
        name,
        type,
        period_start: new Date(period_start),
        period_end: new Date(period_end),
        format,
        company_id,
        created_by_id: userId,
        status: "PENDING"
      }
    });

    // Enqueue the report task to BullMQ
    if (reportsQueue) {
      await reportsQueue.add(`generate-report-${task.id}`, {
        taskId: task.id,
        companyId: company_id
      });
    } else {
      console.warn("reportsQueue is not initialized. Background jobs disabled.");
      // In case Redis is down, we could trigger it synchronously here or return error
      return NextResponse.json({ 
        error: "Redis/Queue system is offline. Async generation failed." 
      }, { status: 503 });
    }

    // Log the audit event
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: "CREATE",
        entity_type: "SALES_REPORT",
        entity_id: task.id,
        after_state: JSON.stringify(task),
        company_id,
      }
    });

    await cacheInvalidate(`cache:reports:${company_id}`);

    return NextResponse.json({ success: true, taskId: task.id, status: "PENDING" }, { status: 202 });
  } catch (error) {
    console.error("POST /api/reports error:", error);
    return NextResponse.json({ error: "Failed to trigger report generation" }, { status: 500 });
  }
}
