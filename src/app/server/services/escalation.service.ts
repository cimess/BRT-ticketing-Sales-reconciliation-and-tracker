import { prisma } from "@/lib/prisma";

export async function checkAndEscalateExpectations(companyId: string) {
  const now = new Date();

  // Find shortage rule for grace period and fine amount
  const shortageRule = await prisma.companyRule.findFirst({
    where: {
      company_id: companyId,
      target_field: "shortage_amount",
      is_active: true
    }
  });

  const graceHours = shortageRule ? shortageRule.comparison_value : 24;

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
    
    // Violation threshold: Custom grace hours after POS session allocation started
    const sessionAssignedAt = exp.pos_session?.assigned_at 
      ? new Date(exp.pos_session.assigned_at) 
      : new Date(exp.created_at);
    const violationDate = new Date(sessionAssignedAt.getTime() + graceHours * 60 * 60 * 1000);

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
            // Fine amount: Set from configured shortage rule (falls back to null for manual adjustment)
            const fineAmount = shortageRule ? shortageRule.fine_amount : null;

            await tx.fine.create({
              data: {
                company_id: companyId,
                defaulter_id: exp.user_id,
                issued_by: systemUserId,
                amount: fineAmount,
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

export async function checkSupervisorDepositViolations(companyId: string) {
  const now = new Date();
  
  // Find active deposit rule for grace period and fine amount
  const depositRule = await prisma.companyRule.findFirst({
    where: {
      company_id: companyId,
      target_field: "deposit_delay",
      is_active: true
    }
  });

  const graceHours = depositRule ? depositRule.comparison_value : 24;
  const depositDeadlineMs = graceHours * 60 * 60 * 1000; 

  const pendingDeposits = await prisma.remittance.findMany({
    where: {
      company_id: companyId,
      status: "ACCEPTED_BY_SUPERVISOR",
      verified_at: {
        not: null,
      }
    }
  });

  for (const remit of pendingDeposits) {
    if (!remit.verified_at || !remit.received_by_supervisor_id) continue;

    const acceptedAt = new Date(remit.verified_at);
    const deadline = new Date(acceptedAt.getTime() + depositDeadlineMs);

    if (now > deadline) {
      await prisma.$transaction(async (tx) => {
        const currentRemit = await tx.remittance.findUnique({
          where: { id: remit.id }
        });
        
        if (!currentRemit || currentRemit.status !== "ACCEPTED_BY_SUPERVISOR") {
          return;
        }

        const fineReason = `Late bank deposit violation for Remittance ${remit.id}`;

        const existingFine = await tx.fine.findFirst({
          where: {
            company_id: companyId,
            defaulter_id: remit.received_by_supervisor_id!,
            reason: fineReason
          }
        });

        if (!existingFine) {
          const adminUser = await tx.user.findFirst({
            where: { company_id: companyId, role: "ADMIN" }
          });
          const systemUserId = adminUser ? adminUser.id : remit.received_by_supervisor_id!;

          // Fine amount: Set from configured deposit rule (falls back to null for manual adjustment)
          const fineAmount = depositRule ? depositRule.fine_amount : null;

          await tx.fine.create({
            data: {
              company_id: companyId,
              defaulter_id: remit.received_by_supervisor_id!,
              issued_by: systemUserId,
              amount: fineAmount,
              reason: fineReason,
              status: "UNPAID"
            }
          });

          await tx.auditLog.create({
            data: {
              company_id: companyId,
              user_id: systemUserId,
              action: "CREATE",
              entity_type: "FINE",
              entity_id: remit.id,
              after_state: {
                reason: fineReason,
                target_user: remit.received_by_supervisor_id,
                message: `Automated deposit violation fine created for supervisor.`
              }
            }
          });
        }
      });
    }
  }
}
