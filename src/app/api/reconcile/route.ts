// src/app/api/reconcile/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/ApiError";
import { checkAndEscalateExpectations } from "@/server/services/escalation.service";

export async function GET(req: NextRequest) {
    try {

        
        const session = await auth();
        if (!session?.user || !session.user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: userId, role, company_id } = session.user;

        await checkAndEscalateExpectations(company_id);

        if (role === "ADMIN" || role === "AUDITOR") {
            const expectations = await prisma.remittanceExpectation.findMany({
                where: {
                    company_id,
                    status: { in: ["OVERDUE", "VIOLATED"] }
                },
                include: {
                    user: { select: { id: true, first_name: true, last_name: true, role: true } },
                    pos_session: {
                        include: {
                            device: { select: { name: true } }
                        }
                    }
                },
                orderBy: { due_date: "asc" }
            });

           const remittances = await prisma.remittance.findMany({
                where: {
                    company_id,
                    status: { in: ["PENDING", "ACCEPTED_BY_SUPERVISOR", "DEPOSITED", "PENDING_SUPERVISOR_ACCEPTANCE"] },
                    pos_session: {
                        remittance_expectation: {
                            status: { in: ["OVERDUE", "VIOLATED", "SUBMITTED"] }
                        }
                    }
                },
                include: {
                    ticketer: { select: { id: true, first_name: true, last_name: true, role: true } },
                    pos_session: {
                        include: {
                            device: { select: { name: true } }
                        }
                    }
                },
                orderBy: { created_at: "desc" }
            });

            return NextResponse.json({ success: true, expectations, remittances });
        }

        if (role === "SUPERVISOR") {
            const expectations = await prisma.remittanceExpectation.findMany({
                where: {
                    company_id,
                    status: { in: ["OVERDUE", "VIOLATED"] },
                    OR: [
                        { user: { supervisor_id: userId } },
                        { user_id: userId }
                    ]
                },
                include: {
                    user: { select: { id: true, first_name: true, last_name: true, role: true } },
                    pos_session: {
                        include: {
                            device: { select: { name: true } }
                        }
                    }
                },
                orderBy: { due_date: "asc" }
            });

            const remittances = await prisma.remittance.findMany({
                where: {
                    company_id,
                    status: { in: ["PENDING", "ACCEPTED_BY_SUPERVISOR", "PENDING_SUPERVISOR_ACCEPTANCE", "DEPOSITED"] },
                    pos_session: {
                        remittance_expectation: {
                            status: { in: ["OVERDUE", "VIOLATED", "SUBMITTED"] }
                        }
                    },
                    ticketer: {
                        supervisor_id: userId
                    }
                },
                include: {
                    ticketer: { select: { id: true, first_name: true, last_name: true, role: true } },
                    pos_session: {
                        include: {
                            device: { select: { name: true } }
                        }
                    }
                },
                orderBy: { created_at: "desc" }
            });


            return NextResponse.json({ success: true, expectations, remittances });
        }

        if (role === "TICKETER") {
            const expectations = await prisma.remittanceExpectation.findMany({
                where: {
                    company_id,
                    user_id: userId,
                    status: { not: "PAID" }
                },
                include: {
                    user: { select: { id: true, first_name: true, last_name: true, role: true } },
                    pos_session: {
                        include: {
                            device: { select: { name: true } }
                        }
                    }
                },
                orderBy: { due_date: "asc" }
            });

            const remittances = await prisma.remittance.findMany({
                where: {
                    company_id,
                    submitted_by: userId,
                    status: { in: ["PENDING", "ACCEPTED_BY_SUPERVISOR", "PENDING_SUPERVISOR_ACCEPTANCE","CONFIRMED"] },
                    pos_session: {
                        remittance_expectation: {
                            status: { in: ["OVERDUE", "VIOLATED", "SUBMITTED","PAID"] }
                        }
                    }
                },
                include: {
                    ticketer: { select: { id: true, first_name: true, last_name: true, role: true } },
                    pos_session: {
                        include: {
                            device: { select: { name: true } }
                        }
                    }
                },
                orderBy: { created_at: "desc" }
            });


            return NextResponse.json({ success: true, expectations, remittances });
        }

        return NextResponse.json({ success: true, expectations: [], remittances: [] });
    } catch (error) {
        console.error("GET /api/reconcile error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user || !session.user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: callerId, role, company_id } = session.user;

        // 🔒 Strictly restrict reconciliation payment submission to TICKETERS
        if (role !== "TICKETER") {
            return NextResponse.json({ 
                error: "Unauthorized. Only ticketers can submit reconciliation payments for their expectations." 
            }, { status: 403 });
        }

        const body = await req.json();
        const { expectationId, amount, method, payment_reference, supervisor_id } = body;

        if (!expectationId || !amount || Number(amount) <= 0 || !method) {
            return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
        }

        const remittanceAmount = new Prisma.Decimal(amount);

        const remittance = await prisma.$transaction(async (tx) => {
            const expectation = await tx.remittanceExpectation.findUnique({
                where: { id: expectationId, company_id },
                include: { user: true }
            });

            if (!expectation) {
                throw new ApiError(404, "Remittance expectation not found");
            }

            if (expectation.status === "PAID") {
                throw new ApiError(400, "This expectation has already been fully settled");
            }

            if (expectation.user_id !== callerId) {
                throw new ApiError(403, "You can only submit reconciliation payments for your own expectations");
            }

            // 💡 Calculate remaining due balance to prevent overpayment
            const existingPending = await tx.remittance.aggregate({
                where: {
                    company_id,
                    submitted_by: callerId,
                    pos_session_id: expectation.pos_session_id,
                    status: { in: ["PENDING", "PENDING_SUPERVISOR_ACCEPTANCE"] }
                },
                _sum: { amount: true }
            });

            const pendingTotal = Number(existingPending._sum.amount || 0);
            const targetAmount = Number(expectation.shortage_amount) > 0 
                ? Number(expectation.shortage_amount) 
                : Number(expectation.expected_amount);
            const remainingDue = targetAmount - pendingTotal;

            if (Number(remittanceAmount) > remainingDue) {
                throw new ApiError(
                    400,
                    `Remittance amount (₦${amount}) exceeds remaining due balance (₦${remainingDue}). Existing pending: ₦${pendingTotal}`
                );
            }

            let receivedBySupId: string | null = null;
            let initialStatus: "PENDING" | "PENDING_SUPERVISOR_ACCEPTANCE" = "PENDING";

            if (method === "CASH") {
                initialStatus = "PENDING_SUPERVISOR_ACCEPTANCE";
                receivedBySupId = supervisor_id || null;
                
                if (!receivedBySupId) {
                    throw new ApiError(400, "Please select a supervisor to hand physical cash to.");
                }
            }

            const newRemittance = await tx.remittance.create({
                data: {
                    company_id,
                    submitted_by: callerId,
                    amount: remittanceAmount,
                    method,
                    payment_reference: payment_reference || null,
                    remittance_date: new Date(),
                    status: initialStatus,
                    pos_session_id: expectation.pos_session_id,
                    received_by_supervisor_id: receivedBySupId
                }
            });

            return newRemittance;
        });

        return NextResponse.json({ success: true, remittance });
    } catch (error) {
        console.error("POST /api/reconcile error:", error);
        return NextResponse.json({
            error: error instanceof ApiError ? error.message : "Internal Server Error"
        }, { status: error instanceof ApiError ? error.statusCode : 500 });
    }
}

