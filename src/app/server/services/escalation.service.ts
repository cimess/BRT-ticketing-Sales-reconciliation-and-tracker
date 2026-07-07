// src/app/server/services/escalation.service.ts
import { prisma } from "@/lib/prisma";
import { sendNotification } from "./notification.service";

/**
 * Worker to check for overdue/violated remittance expectations
 * and apply "Shortage Remittance Policy" fines.
 */
export async function checkAndEscalateExpectations(companyId: string) {
  const now = new Date();

  // Find active Shortage Remittance rule
  const shortageRule = await prisma.companyRule.findFirst({
    where: {
      company_id: companyId,
      name: "Shortage Remittance Policy",
      is_active: true
    }
  });

  const graceHours = shortageRule ? shortageRule.comparison_value : 24;

  // 1. Include sales reports and locations to fetch closing hours if they exist
  const expectations = await prisma.remittanceExpectation.findMany({
    where: {
      company_id: companyId,
      status: { in: ["PENDING", "SUBMITTED", "OVERDUE"] }
    },
    include: {
      pos_session: {
        include: {
          sales_reports: {
            where: { status: { notIn: ["CANCELLED", "REJECTED"] } },
            orderBy: { submitted_at: "desc" },
            take: 1,
            include: {
              location: true
            }
          }
        }
      }
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
    const sessionDate = exp.pos_session?.assigned_at 
      ? new Date(exp.pos_session.assigned_at) 
      : new Date(exp.created_at);
    
    // 2. Fetch the ticketer's location assignment for the assignment day
    const startOfDay = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
    const endOfDay = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate(), 23, 59, 59, 999);

    const assignment = await prisma.ticketer_Location_Assignment.findFirst({
      where: {
        user_id: exp.user_id,
        assigned_for: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: {
        location: true
      }
    });

    const location = assignment?.location || exp.pos_session?.sales_reports?.[0]?.location;

    // 3. Establish the base closing date-time of the session assignment day
    const closingDateTime = new Date(sessionDate);
    if (location?.closing_time) {
      const [hours, minutes] = location.closing_time.split(":").map(Number);
      closingDateTime.setHours(hours, minutes, 0, 0);
    } else {
      // Fallback: 6:00 PM on assignment day
      closingDateTime.setHours(18, 0, 0, 0);
    }

    // 4. Violation date = closingDateTime + policy grace hours
    const violationDate = new Date(closingDateTime.getTime() + graceHours * 60 * 60 * 1000);


    let targetStatus: "OVERDUE" | "VIOLATED" | null = null;

    if (now > violationDate) {
      targetStatus = "VIOLATED";
    } else if (now > dueDate) {
      targetStatus = "OVERDUE";
    }

   if (targetStatus && targetStatus !== exp.status) {
      const fineResult = await prisma.$transaction(async (tx) => {
        const currentExp = await tx.remittanceExpectation.findUnique({
          where: { id: exp.id }
        });
        if (!currentExp || currentExp.status === "PAID" || currentExp.status === targetStatus) {
          return null;
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
              reason: `Escalated automatically: due date ${dueDate.toISOString()}, grace hours ${graceHours}h after allocation start`
            }
          }
        });
        let fineCreated = null;
        // Issue automated Fine if status escalates to VIOLATED
        if (targetStatus === "VIOLATED") {
          const fineReason = `Overdue Shortage Remittance: POS Session ${exp.pos_session_id}`;
          
          const existingFine = await tx.fine.findFirst({
            where: {
              company_id: companyId,
              defaulter_id: exp.user_id,
              reason: fineReason
            }
          });
          if (!existingFine) {
            const fineAmount = shortageRule ? shortageRule.fine_amount : null;
            fineCreated = await tx.fine.create({
              data: {
                company_id: companyId,
                defaulter_id: exp.user_id,
                issued_by: systemUserId,
                amount: fineAmount,
                reason: fineReason,
                status: "UNPAID"
              }
            });
            console.log(`Issued automated Shortage Remittance fine to ticketer: ${exp.user_id}`);
          }
        }
        return { fineCreated };
      });
      if (fineResult?.fineCreated) {
        const fine = fineResult.fineCreated;
        const formattedAmount = fine.amount ? Number(fine.amount).toLocaleString() : "TBD";
        await sendNotification({
          companyId: companyId,
          message: `System issued a late remittance fine of ₦${formattedAmount} for POS Session ${exp.pos_session_id}.`,
          type: "FINE_ISSUED",
          referenceId: fine.id,
          target: {
            userIds: [exp.user_id],
            roles: ["ADMIN"],
          }
        });
      }
    }
  }
}

/**
 * Worker to check for supervisor late bank deposits
 * and apply "Late Bank Deposit Policy" fines.
 */
export async function checkSupervisorDepositViolations(companyId: string) {
  const now = new Date();
  
  // Find active Late Bank Deposit rule
  const depositRule = await prisma.companyRule.findFirst({
    where: {
      company_id: companyId,
      name: "Late Bank Deposit Policy",
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
     
      const fineResult = await prisma.$transaction(async (tx) => {
        const currentRemit = await tx.remittance.findUnique({
          where: { id: remit.id }
        });
        
        if (!currentRemit || currentRemit.status !== "ACCEPTED_BY_SUPERVISOR") {
          return null;
        }

        const fineReason = `Late bank deposit violation for Remittance ${remit.id}`;

        const existingFine = await tx.fine.findFirst({
          where: {
            company_id: companyId,
            defaulter_id: remit.received_by_supervisor_id!,
            reason: fineReason
          }
        });

        let fineCreated = null;
        if (!existingFine) {
          const adminUser = await tx.user.findFirst({
            where: { company_id: companyId, role: "ADMIN" }
          });
          const systemUserId = adminUser ? adminUser.id : remit.received_by_supervisor_id!;
          const fineAmount = depositRule ? depositRule.fine_amount : null;

          fineCreated = await tx.fine.create({
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
          console.log(`Issued automated Late Deposit fine to supervisor: ${remit.received_by_supervisor_id}`);
        }
        return { fineCreated };
      });

      if (fineResult?.fineCreated) {
        const fine = fineResult.fineCreated;
        const formattedAmount = fine.amount ? Number(fine.amount).toLocaleString() : "TBD";
        await sendNotification({
          companyId: companyId,
          message: `System issued a late bank deposit fine of ₦${formattedAmount} for Remittance ${remit.id}.`,
          type: "FINE_ISSUED",
          referenceId: fine.id,
          target: {
            userIds: [remit.received_by_supervisor_id!],
            roles: ["ADMIN"],
          }
        });
      }

    }
  }
}
