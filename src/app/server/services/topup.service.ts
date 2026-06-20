import { prisma } from "@/lib/prisma";
import { AddTopUp, ReverseTopUp } from "@/types/types";
import { Prisma } from "@prisma/client";
import { broadcast } from "@/lib/sseEvent/sse";
import { ApiError } from "@/lib/ApiError";

export async function addTopUp(
  data: AddTopUp,
  meta: { ip: string; user: { id: string; role: string; company_id: string } }
) {
  try {


    const { amount, allocated_from, allocationNote } = data;
    const { ip, user } = meta;

    const topUp = await prisma.$transaction(async (tx) => {

      // 1. Create topup
      const topUp = await tx.topUp.create({

        data: {
          company_id: user.company_id,
          amount,
          allocated_from,
          allocationNote,
        },
      });

      // 2. Get or create company float safely
      const companyFloat = await tx.companyFloat.upsert({
        where: { id: "COMPANY_ACCOUNT" },
        create: {
          company_id: user.company_id,
          id: "COMPANY_ACCOUNT",
          available_balance: amount,
        },
        update: {
          available_balance: {
            increment: amount,
          },
        },
      });

      // 3. Ledger entry (single source)
      await tx.float_Ledger.create({
        data: {
          company_id: user.company_id,
          account_id: companyFloat.id,
          account_type: "COMPANY",
          amount,
          entry_type: "CREDIT",
          reference_type: "TOP_UP",
          reference_id: topUp.id,
          description: allocationNote,
        },
      });

      // 4. Audit log (FIXED actor)
      await tx.auditLog.create({
        data: {
          company_id: user.company_id,
          user_id: user.id,
          action: "CREATE",
          entity_type: "TOPUP",
          entity_id: topUp.id,
          before_state: { available_balance: Number(companyFloat.available_balance) - amount },
          after_state: { available_balance: Number(companyFloat.available_balance) },
          meta: {
            source: "admin dashboard(web)",
            ip,
          },
        },
      });

      return topUp;
    });

    // 5. REAL-TIME EVENT (SSE HOOK)
    broadcast("TOPUP_CREATED", {
      topUpId: topUp.id,
      amount,
      allocated_from,
    }, ["ADMIN", "SUPERVISOR"]);

    return {
      success: true,
      message: "Top up added successfully",
      topUp,
    };
  } catch (error) {
    console.log("error in adding top up", error);

    throw error instanceof ApiError ? error : new ApiError(500, "Internal server error");
  }
}

export async function reverseTopUp(data: ReverseTopUp, meta: { ip: string, userid: string, company_id: string }) {




  try {

    const { id } = data
    const { ip, userid } = meta

    const topUp = await prisma.$transaction(async (tx) => {

      const existingTopUp = await tx.topUp.findUnique({
        where: {
          id,
          company_id: meta.company_id,
        }
      })

      if (!existingTopUp) {
        throw new ApiError(404, "Top up not found")
      }

      if (existingTopUp.status === "CANCELLED") {
        throw new ApiError(400, "Top up is already cancelled")

      }

      const companyFloat = await tx.companyFloat.findUnique({
        where: { id: "COMPANY_ACCOUNT", company_id: meta.company_id }
      });
      if (!companyFloat || new Prisma.Decimal(companyFloat.available_balance).lt(existingTopUp.amount)) {
        throw new ApiError(400, "Cannot cancel TopUp: Float has already been allocated to users and available balance is too low.")

      }
      const cancelTopUp = await tx.topUp.update({
        where: { id, company_id: meta.company_id },
        data: {
          status: "CANCELLED",
          allocationNote: "TopUp Cancelled by Admin"
        }
      })

      await tx.companyFloat.update({
        where: { id: "COMPANY_ACCOUNT", company_id: meta.company_id },
        data: {
          available_balance: companyFloat.available_balance.minus(existingTopUp.amount)
        }
      })

      await tx.float_Ledger.create({
        data: {
          company_id: meta.company_id,
          account_id: companyFloat.id,
          account_type: "COMPANY",
          amount: existingTopUp.amount,
          entry_type: "DEBIT",
          reference_type: "TOP_UP_CANCEL",
          reference_id: cancelTopUp.id,
          description: "TopUp Cancelled by Admin",
        }
      })

      await tx.auditLog.create({
        data: {
          company_id: meta.company_id,
          user_id: userid,
          action: "UPDATE",
          entity_type: "TOPUP",
          entity_id: cancelTopUp.id,
          before_state: existingTopUp,
          after_state: cancelTopUp,
          meta: { source: "admin dashboard", ip }
        }
      })

      return cancelTopUp
    })

    return {
      status: 200,
      success: true,
      message: "Top up cancelled successfully",
      topUp
    }
  } catch (error) {
    console.log("error in cancelling top up  ", error)

    throw error instanceof ApiError ? error : new ApiError(500, "Internal server error");


  }
}

export async function deleteTopUp(data: { id: string, user: { id: string } }, meta: { ip: string, userAgent: string, company_id: string }) {



  try {
    const { id, user } = data
    const { ip, userAgent } = meta
    const company_float_id = "COMPANY_ACCOUNT"
    await prisma.$transaction(async (tx) => {

      const existingTopUp = await tx.topUp.findUnique({
        where: {
          id,
          company_id: meta.company_id,
        }
      })

      if (!existingTopUp) {
        throw new ApiError(404, "Top up not found")
      }

      if (existingTopUp.status === "CANCELLED") {
        throw new ApiError(400, "Top up is already cancelled")
      }


      const companyFloat = await tx.companyFloat.findUnique({
        where: { id: company_float_id, company_id: meta.company_id }
      });
      if (!companyFloat || new Prisma.Decimal(companyFloat.available_balance).lt(existingTopUp.amount)) {
        throw new ApiError(400, "Cannot cancel TopUp: Float has already been allocated to users and available balance is too low.")
      }
      const cancelTopUp = await tx.topUp.update({
        where: {
          id
        },
        data: {
          status: "CANCELLED"
        }
      })



      await tx.companyFloat.update({
        where: {
          id: company_float_id,
          company_id: meta.company_id,
        },
        data: {
          available_balance: {
            decrement: existingTopUp.amount
          }
        }
      })
      await tx.float_Ledger.create({
        data: {
          company_id: meta.company_id,
          account_id: "COMPANY_ACCOUNT",
          account_type: "COMPANY",
          amount: existingTopUp.amount,
          entry_type: "DEBIT",
          reference_type: "TOP_UP_DELETION",
          reference_id: existingTopUp.id,
          description: "Top up deleted",
        }
      })

      await tx.auditLog.create({
        data: {
          company_id: meta.company_id,
          user_id: user.id,
          action: "DELETE",
          entity_type: "TOPUP",
          entity_id: existingTopUp.id,
          before_state: existingTopUp,
          after_state: cancelTopUp,
          meta: {
            source: "admin dashboard(web)",
            ip,
            userAgent
          }
        }
      })

      return cancelTopUp
    })

    return {
      success: true,
      message: "Top up deleted successfully",
    }

  } catch (error) {
    console.log("error in deleting top up  ", error)
     throw error instanceof ApiError ? error : new ApiError(500, "Internal server error");
    }
  }


export type GetTopUpsInput = {
  fromDate?: string;
  toDate?: string;
  minAmount?: number;
  maxAmount?: number;

  cursor?: string; // last seen ID
  limit?: number;  // batch size


};

export async function getTopUps({ query, company_id }: { query?: GetTopUpsInput, company_id: string }) {

  try {

    const {
      fromDate,
      toDate,
      minAmount,
      maxAmount,
      cursor,
      limit,
    } = query ?? {};

    const hasFilters =
      fromDate ||
      toDate ||
      minAmount !== undefined ||
      maxAmount !== undefined ||
      cursor;

    const where: Prisma.TopUpWhereInput = {};

    // 📅 date filter
    if (fromDate || toDate) {
      where.date_received = {
        ...(fromDate && { gte: new Date(fromDate) }),
        ...(toDate && { lte: new Date(toDate) }),
      };
    }

    // 💰 amount filter
    if (minAmount !== undefined || maxAmount !== undefined) {
      where.amount = {
        ...(minAmount !== undefined && { gte: minAmount }),
        ...(maxAmount !== undefined && { lte: maxAmount }),
      };
    }

    const dbTopups = await prisma.topUp.findMany({
      where: { ...where, company_id },
      orderBy: {
        date_received: "desc",
      },

      // 👇 KEY CHANGE:
      // - login mode → 1 record only
      // - filtered mode → normal pagination size
      take: hasFilters ? (limit ?? 50) + 1 : 20,

      ...(cursor && hasFilters
        ? {
          cursor: {
            id: cursor,
          },
          skip: 1,
        }
        : {}),
    });

    const topups = dbTopups.map((t) => ({
      id: t.id,
      amount: Number(t.amount),
      allocated_from: t.allocated_from,
      allocationNote: t.allocationNote,
      status: t.status,
      date_received: t.date_received.toISOString(),
    }));

    let nextCursor: string | null = null;

    // only calculate pagination when in filtered mode
    if (hasFilters && topups.length > (limit ?? 50)) {
      const nextItem = topups.pop();
      nextCursor = nextItem?.id ?? null;
    }

    return {
      success: true,
      message: hasFilters
        ? "Topups fetched with filters"
        : "Latest topup fetched",
      topups,
      nextCursor,
    };
  } catch (error) {
    console.log("getTopUps error:", error);

    throw error instanceof ApiError ? error : new ApiError(500, "Internal server error");

  }
}