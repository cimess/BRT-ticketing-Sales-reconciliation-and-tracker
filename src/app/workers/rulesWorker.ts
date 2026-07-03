// src/app/workers/rulesWorker.ts
import { Worker, WorkerOptions } from "bullmq"; 
import IORedis from "ioredis";
import { prisma } from "@/lib/prisma";

// Safe dynamic comparison helper
function evaluateCondition(actual: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case ">": return actual > threshold;
    case ">=": return actual >= threshold;
    case "<": return actual < threshold;
    case "<=": return actual <= threshold;
    case "==": return actual === threshold;
    default: return false;
  }
}

// Main evaluation logic (can run in Worker or synchronously as fallback)
export async function runRuleEvaluation(payload: { event: string; reportId: string; companyId: string }) {
  const { event, reportId, companyId } = payload;

  // 1. Hydrate contextual data for the rule evaluation
  const report = await prisma.salesReport.findFirst({
    where: { id: reportId, company_id: companyId },
    include: { pos_device: true }
  });
  if (!report) return;

  const expectation = await prisma.remittanceExpectation.findFirst({
    where: { pos_session_id: report.pos_session_id }
  });

  // Calculate delay if any (time between location closing time and physical submission)
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

  // Define context variables accessible to admin rules
  const context: Record<string, number> = {
    shortage_amount: expectation?.shortage_amount ?? 0,
    opening_balance: report.opening_balance,
    closing_balance: report.closing_balance,
    total_sold: report.total_sold,
    hours_late_submitting: hoursLateSubmitting
  };

  // 2. Fetch active rules for the triggered event
  const activeRules = await prisma.companyRule.findMany({
    where: {
      company_id: companyId,
      trigger: event,
      is_active: true
    }
  });

  // 3. Evaluate each rule
  for (const rule of activeRules) {
    const actualValue = context[rule.target_field];
    if (actualValue === undefined) continue; // Rule targets a field that doesn't exist in context

    const isViolated = evaluateCondition(actualValue, rule.operator, rule.comparison_value);

    if (isViolated) {
      // 4. Create automated Fine
      await prisma.fine.create({
        data: {
          company_id: companyId,
          defaulter_id: report.ticketer_id,
          amount: rule.fine_amount,
          reason: `Automated Rule Penalty: ${rule.name}`,
          issued_by: "SYSTEM_RULES_ENGINE", // Custom system tag
          status: "UNPAID"
        }
      });
      console.log(`Successfully issued automated fine for rule: ${rule.name} to user: ${report.ticketer_id}`);
    }
  }
}

const REDIS_URL = process.env.REDIS_URL;
if (REDIS_URL) {
  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  // Cast connection using WorkerOptions["connection"] to bypass ESLint 'any' checks
  new Worker("rules-queue", async (job) => {
    console.log(`Processing rule job ${job.id} for event: ${job.data.event}`);
    await runRuleEvaluation(job.data);
  }, { 
    connection: connection as unknown as WorkerOptions["connection"] 
  });
}
