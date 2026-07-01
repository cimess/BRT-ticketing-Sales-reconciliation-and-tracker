import { prisma } from "@/lib/prisma";

export async function checkAndEscalateExpectations(companyId: string) {
  const now = new Date();

  // Find all unresolved expectations
  const expectations = await prisma.remittanceExpectation.findMany({
    where: {
      company_id: companyId,
      status: { in: ["PENDING", "SUBMITTED", "OVERDUE"] }
    },
    include: {
      pos_session: true
    }
  });

  for (const exp of expectations) {
    const shortageAmount = Number(exp.shortage_amount);
    if (shortageAmount <= 0) {
      await prisma.remittanceExpectation.update({
        where: { id: exp.id },
        data: { status: "PAID" }
      });
      continue;
    }

    const dueDate = new Date(exp.due_date);
    
    // Violation threshold: 24h after POS session allocation started
    const sessionAssignedAt = exp.pos_session?.assigned_at 
      ? new Date(exp.pos_session.assigned_at) 
      : new Date(exp.created_at);
    const violationDate = new Date(sessionAssignedAt.getTime() + 24 * 60 * 60 * 1000);

    let targetStatus: "OVERDUE" | "VIOLATED" | null = null;

    if (now > violationDate) {
      targetStatus = "VIOLATED";
    } else if (now > dueDate) {
      targetStatus = "OVERDUE";
    }

    if (targetStatus && targetStatus !== exp.status) {
      await prisma.$transaction(async (tx) => {
        const currentExp = await tx.remittanceExpectation.findUnique({
          where: { id: exp.id }
        });
        if (!currentExp || currentExp.status === "PAID" || currentExp.status === targetStatus) {
          return;
        }

        await tx.remittanceExpectation.update({
          where: { id: exp.id },
          data: { status: targetStatus }
        });

        // Resolve system administrator to log the escalation
        const adminUser = await tx.user.findFirst({
          where: { company_id: companyId, role: "ADMIN" }
        });
        const systemUserId = adminUser ? adminUser.id : exp.user_id;

        await tx.auditLog.create({
          data: {
            company_id: companyId,
            user_id: systemUserId,
            action: "UPDATE",
            entity_type: "REMITTANCE_EXPECTATION",
            entity_id: exp.id,
            after_state: {
              status: targetStatus,
              reason: `Escalated automatically: due date ${dueDate.toISOString()}, allocation start ${sessionAssignedAt.toISOString()}`
            }
          }
        });

        // Issue automated Fine if status is VIOLATED
        if (targetStatus === "VIOLATED") {
          const fineReason = `Overdue Remittance Violation for POS Session ${exp.pos_session_id}`;
          
          const existingFine = await tx.fine.findFirst({
            where: {
              company_id: companyId,
              defaulter_id: exp.user_id,
              reason: fineReason
            }
          });

          if (!existingFine) {
            // Fine amount: 10% of the shortage or flat 500, whichever is greater
            const fineAmount = Math.max(500, shortageAmount * 0.1);

            // here we have to not add the amount automatically instead we 
            // create the fine and reason admin/supervisor input the amount 

            await tx.fine.create({
              data: {
                company_id: companyId,
                defaulter_id: exp.user_id,
                issued_by: systemUserId,
                amount: null,
                reason: fineReason,
                status: "UNPAID"
              }
            });
          }
        }
      });
    }
  }
}
