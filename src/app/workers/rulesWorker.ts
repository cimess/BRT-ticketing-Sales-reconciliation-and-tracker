// src/app/workers/rulesWorker.ts
import { Worker, WorkerOptions } from "bullmq"; 
import IORedis from "ioredis";
import { prisma } from "@/app/lib/prisma";
import { sendNotification } from "../server/services/notification.service";
import { checkAndEscalateExpectations, checkSupervisorDepositViolations } from "../server/services/escalation.service";

export async function runRuleEvaluation(payload: { event: string; reportId: string; companyId: string }) {
  const { event, reportId, companyId } = payload;

  // We only run this worker on report submission events
  if (event !== "ON_REPORT_SUBMISSION") return;

  const report = await prisma.salesReport.findFirst({
    where: { id: reportId, company_id: companyId },
    include: { pos_device: true }
  });
  if (!report) return;

  // 1. Fetch active "Late Report Submission Policy" directly by Name
  const rule = await prisma.companyRule.findFirst({
    where: {
      company_id: companyId,
      name: "Late Report Submission Policy",
      is_active: true
    }
  });
  if (!rule) return;

  // 2. Calculate hours late from the location's closing time
  let hoursLateSubmitting = 0;
  const location = await prisma.location.findFirst({ where: { id: report.location_id } });
  if (location?.closing_time && report.submitted_at) {
    const sessionDate = new Date(report.report_date);
    const [hours, minutes] = location.closing_time.split(":").map(Number);
    const closeTime = new Date(sessionDate);
    closeTime.setHours(hours, minutes, 0, 0);

    const submissionTime = new Date(report.submitted_at);
    if (submissionTime > closeTime) {
      hoursLateSubmitting = (submissionTime.getTime() - closeTime.getTime()) / (1000 * 60 * 60);
    }
  }

  // 3. Direct comparison: If late, issue the fine
  if (hoursLateSubmitting > rule.comparison_value) {
    const ticketer = await prisma.user.findUnique({
      where: { id: report.ticketer_id },
      select: { supervisor_id: true }
    });

    let issuerId = ticketer?.supervisor_id;
    if (!issuerId) {
      const adminUser = await prisma.user.findFirst({
        where: { company_id: companyId, role: "ADMIN" },
        select: { id: true }
      });
      issuerId = adminUser?.id || report.ticketer_id;
    }

    const reportDateStr = new Date(report.report_date).toISOString().split('T')[0];
    const fineReason = `Late Report Submission: POS Session ${report.pos_session_id} on ${reportDateStr}`;

    // Deduplicate to avoid repeating fines for the same report submission
    const existingFine = await prisma.fine.findFirst({
      where: {
        company_id: companyId,
        defaulter_id: report.ticketer_id,
        reason: fineReason
      }
    });

      if (!existingFine) {
      const fine = await prisma.fine.create({
        data: {
          company_id: companyId,
          defaulter_id: report.ticketer_id,
          amount: rule.fine_amount,
          reason: fineReason,
          issued_by: issuerId,
          status: "UNPAID"
        }
      });
      console.log(`Successfully issued automated fine for Late Report Submission to ticketer: ${report.ticketer_id}`);
      // Send automated fine notification
      const formattedAmount = Number(rule.fine_amount).toLocaleString();
      await sendNotification({
        companyId: companyId,
        message: `System issued a late report submission fine of ₦${formattedAmount} for POS Session ${report.pos_session_id}.`,
        type: "FINE_ISSUED",
        referenceId: fine.id,
        target: {
          userIds: [report.ticketer_id],
          roles: ["ADMIN"],
        }
      });
    }
  }
}

const REDIS_URL = process.env.REDIS_URL;
if (REDIS_URL) {
  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  new Worker("rules-queue", async (job) => {
    if (job.name === "escalate-rules") {
      console.log(`[Scheduler] Processing automated rules escalation job ${job.id}`);
      try {
        const companies = await prisma.company.findMany({ select: { id: true } });
        for (const company of companies) {
          console.log(`[Scheduler] Running escalation checks for company ${company.id}`);
          await checkAndEscalateExpectations(company.id);
          await checkSupervisorDepositViolations(company.id);
        }
      } catch (err) {
        console.error("[Scheduler] Error in automated escalation check:", err);
      }
    } else {
      console.log(`Processing rule job ${job.id} for event: ${job.data.event}`);
      await runRuleEvaluation(job.data);
    }
  }, { 
    connection: connection as unknown as WorkerOptions["connection"] 
  });
}