// src/app/api/admin/commision-earnings/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";


// Get live calculated earnings (dynamic projection) + historical records
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const companyId = session.user.company_id;
    const userRole = session.user.role;
    const userId = session.user.id;

    // Parse query params for scenario calculations
    const { searchParams } = new URL(req.url);
    const queryStart = searchParams.get("startDate");
    const queryEnd = searchParams.get("endDate");

    const isScenario = !!(queryStart && queryEnd);

    // 1. Fetch all finalized historical records from database (bypass if running a scenario)
    const dbEarnings = isScenario 
      ? [] 
      : await prisma.commissionEarning.findMany({
          where: { company_id: companyId },
          include: { 
            user: { 
              select: { first_name: true, last_name: true, email: true, role: true } 
            } 
          },
          orderBy: { created_at: "desc" }
        });

    // 2. Determine date range for current live/unpaid projection
    const latestEarning = dbEarnings[0];
    const liveStart = queryStart 
      ? new Date(queryStart) 
      : (latestEarning ? new Date(latestEarning.period_end) : new Date("2026-06-01"));
    const liveEnd = queryEnd 
      ? new Date(queryEnd) 
      : new Date();

    // Fetch active rules
    const activeRules = await prisma.commission_rules.findMany({
      where: { company_id: companyId, is_active: true }
    });
    const ticketerRule = activeRules.find((r: { role: string }) => r.role === "TICKETER");
    const supervisorRule = activeRules.find((r: { role: string }) => r.role === "SUPERVISOR");


    // Fetch active users (Admin sees all; supervisors/ticketers see themselves)
    const users = await prisma.user.findMany({
      where: { 
        company_id: companyId, 
        role: { in: ["TICKETER", "SUPERVISOR"] },
        ...(userRole !== "ADMIN" ? { id: userId } : {})
      }
    });

    const liveEarnings = [];

    for (const user of users) {
      let totalSales = 0;

      // Calculate sales reports for range
      if (user.role === "TICKETER") {
        const reports = await prisma.salesReport.findMany({
          where: {
            company_id: companyId,
            ticketer_id: user.id,
            status: "VERIFIED",
            verified_at: { gte: liveStart, lte: liveEnd }
          }
        });
        totalSales = reports.reduce((sum: number, r: { total_sold: number }) => sum + r.total_sold, 0);

      } else if (user.role === "SUPERVISOR") {
        const team = await prisma.user.findMany({
          where: { company_id: companyId, supervisor_id: user.id }
        });
        const teamIds = team.map((t: { id: string }) => t.id);

        if (teamIds.length > 0) {
          const reports = await prisma.salesReport.findMany({
            where: {
              company_id: companyId,
              ticketer_id: { in: teamIds },
              status: "VERIFIED",
              verified_at: { gte: liveStart, lte: liveEnd }
            }
          });
         totalSales = reports.reduce((sum: number, r: { total_sold: number }) => sum + r.total_sold, 0);

        }
      }

      const rule = user.role === "SUPERVISOR" ? supervisorRule : ticketerRule;
      if (totalSales === 0 && !rule?.fixed_amount) continue;

      // Commission calculation
      let commissionEarned = 0;
      const pct = rule?.percentage ? (Number(rule.percentage) / 100) : 0;
      const fixed = rule?.fixed_amount ? Number(rule.fixed_amount) : 0;

      if (rule?.percentage && rule?.fixed_amount) {
        commissionEarned = (totalSales * pct) + fixed;
      } else if (rule?.percentage) {
        commissionEarned = totalSales * pct;
      } else if (rule?.fixed_amount) {
        commissionEarned = fixed;
      }

      // Deduct unpaid fines
      const unpaidFines = await prisma.fine.findMany({
        where: {
          company_id: companyId,
          defaulter_id: user.id,
          status: "UNPAID",
          created_at: { gte: liveStart, lte: liveEnd }
        }
      });
   const totalFines = unpaidFines.reduce((sum: number, f: { amount: number | null }) => sum + (f.amount ?? 0), 0);


      // Deduct shortages
      const expectationsWithShortages = await prisma.remittanceExpectation.findMany({
        where: {
          company_id: companyId,
          user_id: user.id,
          shortage_amount: { gt: 0 },
          created_at: { gte: liveStart, lte: liveEnd }
        }
      });
     const totalShortages = expectationsWithShortages.reduce((sum: number, exp: { shortage_amount: number }) => sum + exp.shortage_amount, 0);


      const netPay = Math.max(0, commissionEarned - totalFines - totalShortages);

      liveEarnings.push({
        id: `live_${user.id}`,
        user_id: user.id,
        period_start: liveStart.toISOString(),
        period_end: liveEnd.toISOString(),
        total_sales: totalSales,
        commission_amount: commissionEarned,
        fines_deducted: totalFines,
        shortage_deducted: totalShortages,
        net_pay: netPay,
        status: "PENDING",
        created_at: new Date().toISOString(),
        user: {
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          role: user.role
        }
      });
    }

    // Return combined lists (live dynamic estimates + finalized history)
    return NextResponse.json({ 
      success: true, 
      earnings: [...liveEarnings, ...dbEarnings] 
    });
  } catch (error) {
    console.error("GET commission-earnings error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Mark a specific statement as PAID or reverse it to PENDING
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const companyId = session.user.company_id;

    const body = await req.json();
    const { 
      id, 
      status, 
      userId, 
      periodStart, 
      periodEnd, 
      totalSales, 
      commissionAmount, 
      finesDeducted, 
      shortageDeducted, 
      netPay 
    } = body; 

    if (!id || !status) {
      return NextResponse.json({ error: "id and status are required" }, { status: 400 });
    }

    let updatedEarning;

    if (id.startsWith("live_")) {
      // It's a live projection being marked as PAID! Save it to the database.
      const realUserId = userId || id.replace("live_", "");
      
      updatedEarning = await prisma.commissionEarning.create({
        data: {
          company_id: companyId,
          user_id: realUserId,
          period_start: new Date(periodStart),
          period_end: new Date(periodEnd),
          total_sales: Number(totalSales || 0),
          commission_amount: Number(commissionAmount || 0),
          fines_deducted: Number(finesDeducted || 0),
          shortage_deducted: Number(shortageDeducted || 0),
          net_pay: Number(netPay || 0),
          status: "PAID" // Directly mark as PAID
        }
      });

      // Mark fines in this range as PAID so they don't get double deducted in the future
      const unpaidFines = await prisma.fine.findMany({
        where: {
          company_id: companyId,
          defaulter_id: realUserId,
          status: "UNPAID",
          created_at: { gte: new Date(periodStart), lte: new Date(periodEnd) }
        }
      });
      if (unpaidFines.length > 0) {
        await prisma.fine.updateMany({
          where: { id: { in: unpaidFines.map((f: { id: string }) => f.id) } },
          data: { status: "PAID" }
        });
      }
    } else {
      // It's an existing database record, update status!
      updatedEarning = await prisma.commissionEarning.update({
        where: { id, company_id: companyId },
        data: { status }
      });

      // Update fines status depending on the new status
      if (status === "PAID") {
        const unpaidFines = await prisma.fine.findMany({
          where: {
            company_id: companyId,
            defaulter_id: updatedEarning.user_id,
            status: "UNPAID",
            created_at: { gte: updatedEarning.period_start, lte: updatedEarning.period_end }
          }
        });
        if (unpaidFines.length > 0) {
          await prisma.fine.updateMany({
            where: { id: { in: unpaidFines.map((f: { id: string }) => f.id) } },
            data: { status: "PAID" }
          });
        }
      } else if (status === "PENDING") {
        // Reversing to PENDING. Mark fines in this range as UNPAID.
        await prisma.fine.updateMany({
          where: {
            company_id: companyId,
            defaulter_id: updatedEarning.user_id,
            status: "PAID",
            created_at: { gte: updatedEarning.period_start, lte: updatedEarning.period_end }
          },
          data: { status: "UNPAID" }
        });
      }
    }

    return NextResponse.json({ success: true, earning: updatedEarning });
  } catch (error) {
    console.error("PATCH commission-earnings error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}


// Generate a payroll run (Snapshot and freeze current period)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const companyId = session.user.company_id;

    const body = await req.json();
    const { startDate, endDate } = body; 

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Specify startDate and endDate." }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const activeRules = await prisma.commission_rules.findMany({
      where: { company_id: companyId, is_active: true }
    });
    const ticketerRule = activeRules.find((r: { role: string }) => r.role === "TICKETER");
    const supervisorRule = activeRules.find((r: { role: string }) => r.role === "SUPERVISOR");


    const users = await prisma.user.findMany({
      where: { company_id: companyId, role: { in: ["TICKETER", "SUPERVISOR"] } }
    });

    const generatedEarnings = [];

    for (const user of users) {
      let totalSales = 0;

      if (user.role === "TICKETER") {
        const reports = await prisma.salesReport.findMany({
          where: {
            company_id: companyId,
            ticketer_id: user.id,
            status: "VERIFIED",
            verified_at: { gte: start, lte: end }
          }
        });
        totalSales = reports.reduce((sum: number, r: { total_sold: number }) => sum + r.total_sold, 0);

      } else if (user.role === "SUPERVISOR") {
        const team = await prisma.user.findMany({
          where: { company_id: companyId, supervisor_id: user.id }
        });
        const teamIds = team.map((t: { id: string }) => t.id);

        if (teamIds.length > 0) {
          const reports = await prisma.salesReport.findMany({
            where: {
              company_id: companyId,
              ticketer_id: { in: teamIds },
              status: "VERIFIED",
              verified_at: { gte: start, lte: end }
            }
          });
          totalSales = reports.reduce((sum: number, r: { total_sold: number }) => sum + r.total_sold, 0);

        }
      }

      const rule = user.role === "SUPERVISOR" ? supervisorRule : ticketerRule;
      if (totalSales === 0 && !rule?.fixed_amount) continue;

      let commissionEarned = 0;
      const pct = rule?.percentage ? (Number(rule.percentage) / 100) : 0;
      const fixed = rule?.fixed_amount ? Number(rule.fixed_amount) : 0;

      if (rule?.percentage && rule?.fixed_amount) {
        commissionEarned = (totalSales * pct) + fixed;
      } else if (rule?.percentage) {
        commissionEarned = totalSales * pct;
      } else if (rule?.fixed_amount) {
        commissionEarned = fixed;
      }

      const unpaidFines = await prisma.fine.findMany({
        where: {
          company_id: companyId,
          defaulter_id: user.id,
          status: "UNPAID",
          created_at: { gte: start, lte: end }
        }
      });
     const totalFines = unpaidFines.reduce((sum: number, f: { amount: number | null }) => sum + (f.amount ?? 0), 0);


      const expectationsWithShortages = await prisma.remittanceExpectation.findMany({
        where: {
          company_id: companyId,
          user_id: user.id,
          shortage_amount: { gt: 0 },
          created_at: { gte: start, lte: end }
        }
      });
      const totalShortages = expectationsWithShortages.reduce((sum: number, exp: { shortage_amount: number }) => sum + exp.shortage_amount, 0);


      const netPay = Math.max(0, commissionEarned - totalFines - totalShortages);

      const earning = await prisma.commissionEarning.create({
        data: {
          company_id: companyId,
          user_id: user.id,
          period_start: start,
          period_end: end,
          total_sales: totalSales,
          commission_amount: commissionEarned,
          fines_deducted: totalFines,
          shortage_deducted: totalShortages,
          net_pay: netPay,
          status: "PENDING"
        }
      });

      if (unpaidFines.length > 0) {
        await prisma.fine.updateMany({
          where: { id: { in: unpaidFines.map((f: { id: string }) => f.id) } },
          data: { status: "PAID" }
        });
      }

      generatedEarnings.push(earning);
    }

    return NextResponse.json({ success: true, count: generatedEarnings.length, earnings: generatedEarnings });
  } catch (error) {
    console.error("Salary generation error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}


