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
      // 1. Verify CompanyFloat has sufficient funds to back this operational TopUp
      const companyFloat = await tx.companyFloat.findUnique({
        where: { id: "COMPANY_ACCOUNT", company_id: user.company_id }
      });

      if (!companyFloat || new Prisma.Decimal(companyFloat.available_balance).lt(amount)) {
        throw new ApiError(400, "Insufficient company float available to fund this operational TopUp.");
      }

      // 2. Create the operational TopUp record (for history tracking)
      const newTopUp = await tx.topUp.create({
        data: {
          company_id: user.company_id,
          amount,
          allocated_from,
          allocationNote,
        },
      });

      // 3. Decrement Company Float (Money deployed out of company core asset bank)
      const updatedCompanyFloat = await tx.companyFloat.update({
        where: { id: "COMPANY_ACCOUNT", company_id: user.company_id },
        data: {
          available_balance: {
            decrement: amount,
          },
        },
      });

      // 4. Increment the operational TopUpBank balance (deploy operational budget)
      const topUpBank = await tx.topUpBank.upsert({
        where: { id: "TOPUP_BANK", company_id: user.company_id },
        create: {
          company_id: user.company_id,
          id: "TOPUP_BANK",
          available_balance: amount,
        },
        update: {
          available_balance: {
            increment: amount,
          },
        },
      });

      // 5. Debit Company Float Ledger entry (source account)
      await tx.float_Ledger.create({
        data: {
          company_id: user.company_id,
          account_id: "COMPANY_ACCOUNT",
          account_type: "COMPANY",
          amount,
          entry_type: "DEBIT",
          reference_type: "TOP_UP_DEPLOYMENT",
          reference_id: newTopUp.id,
          description: allocationNote || `TopUp of ${amount} funded from Company Float`,
        },
      });

      // 6. Credit TopUp Bank Ledger entry (destination account)
      await tx.float_Ledger.create({
        data: {
          company_id: user.company_id,
          account_id: "TOPUP_BANK",
          account_type: "TOPUP_BANK",
          amount,
          entry_type: "CREDIT",
          reference_type: "TOP_UP_DEPLOYMENT",
          reference_id: newTopUp.id,
          description: allocationNote || `Operational TopUp of ${amount} received into TopUp Bank`,
        },
      });

      // 7. Log audit log
      await tx.auditLog.create({
        data: {
          company_id: user.company_id,
          user_id: user.id,
          action: "CREATE",
          entity_type: "TOPUP",
          entity_id: newTopUp.id,
          before_state: { 
            company_float_balance: Number(companyFloat.available_balance),
            topup_bank_balance: Number(topUpBank.available_balance) - amount
          },
          after_state: { 
            company_float_balance: Number(updatedCompanyFloat.available_balance),
            topup_bank_balance: Number(topUpBank.available_balance)
          },
          meta: {
            source: "admin dashboard(web)",
            ip,
          },
        },
      });

      return newTopUp;
    });

    // 8. REAL-TIME EVENT (SSE HOOK)
    broadcast("TOPUP_CREATED", {
      topUpId: topUp.id,
      amount,
      allocated_from,
    }, { roles: ["ADMIN", "SUPERVISOR"] });

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
    const { id } = data;
    const { ip, userid } = meta;

    const topUp = await prisma.$transaction(async (tx) => {
      const existingTopUp = await tx.topUp.findUnique({
        where: {
          id,
          company_id: meta.company_id,
        }
      });

      if (!existingTopUp) {
        throw new ApiError(404, "Top up not found");
      }

      if (existingTopUp.status === "CANCELLED") {
        throw new ApiError(400, "Top up is already cancelled");
      }

      // 1. Verify TopUpBank has enough available balance to cover the deletion (not allocated yet)
      const topUpBank = await tx.topUpBank.findUnique({
        where: { id: "TOPUP_BANK", company_id: meta.company_id }
      });

      if (!topUpBank || new Prisma.Decimal(topUpBank.available_balance).lt(existingTopUp.amount)) {
        throw new ApiError(400, "Cannot cancel TopUp: Operational float has already been allocated to users and available balance in TopUp Bank is too low.");
      }

      // 2. Mark TopUp as cancelled
      const cancelTopUp = await tx.topUp.update({
        where: { id, company_id: meta.company_id },
        data: {
          status: "CANCELLED",
          allocationNote: "TopUp Cancelled by Admin"
        }
      });

      // 3. Decrement TopUpBank (withdrawing deployed operational budget)
      const updatedTopUpBank = await tx.topUpBank.update({
        where: { id: "TOPUP_BANK", company_id: meta.company_id },
        data: {
          available_balance: {
            decrement: existingTopUp.amount
          }
        }
      });

      // 4. Increment CompanyFloat (money returns to the company bank pool)
      const updatedCompanyFloat = await tx.companyFloat.update({
        where: { id: "COMPANY_ACCOUNT", company_id: meta.company_id },
        data: {
          available_balance: {
            increment: existingTopUp.amount
          }
        }
      });

      // 5. Debit TopUpBank Ledger Entry
      await tx.float_Ledger.create({
        data: {
          company_id: meta.company_id,
          account_id: "TOPUP_BANK",
          account_type: "TOPUP_BANK",
          amount: existingTopUp.amount,
          entry_type: "DEBIT",
          reference_type: "TOP_UP_CANCEL",
          reference_id: cancelTopUp.id,
          description: "TopUp Cancelled by Admin - withdrawn from TopUp Bank",
        }
      });

      // 6. Credit CompanyFloat Ledger Entry
      await tx.float_Ledger.create({
        data: {
          company_id: meta.company_id,
          account_id: "COMPANY_ACCOUNT",
          account_type: "COMPANY",
          amount: existingTopUp.amount,
          entry_type: "CREDIT",
          reference_type: "TOP_UP_CANCEL",
          reference_id: cancelTopUp.id,
          description: "TopUp Cancelled by Admin - returned to Company Float",
        }
      });

      await tx.auditLog.create({
        data: {
          company_id: meta.company_id,
          user_id: userid,
          action: "UPDATE",
          entity_type: "TOPUP",
          entity_id: cancelTopUp.id,
          before_state: {
            topup: existingTopUp,
            topup_bank_balance: Number(topUpBank.available_balance),
            company_float_balance: Number(updatedCompanyFloat.available_balance) - Number(existingTopUp.amount),
          },
          after_state: {
            topup: cancelTopUp,
            topup_bank_balance: Number(updatedTopUpBank.available_balance),
            company_float_balance: Number(updatedCompanyFloat.available_balance),
          },
          meta: { source: "admin dashboard", ip }
        }
      });

      return cancelTopUp;
    });

    return {
      status: 200,
      success: true,
      message: "Top up cancelled successfully",
      topUp
    };
  } catch (error) {
    console.log("error in cancelling top up  ", error);
    throw error instanceof ApiError ? error : new ApiError(500, "Internal server error");
  }
}

export async function deleteTopUp(data: { id: string, user: { id: string } }, meta: { ip: string, userAgent: string, company_id: string }) {
  try {
    const { id, user } = data;
    const { ip, userAgent } = meta;

    await prisma.$transaction(async (tx) => {
      const existingTopUp = await tx.topUp.findUnique({
        where: {
          id,
          company_id: meta.company_id,
        }
      });

      if (!existingTopUp) {
        throw new ApiError(404, "Top up not found");
      }

      if (existingTopUp.status === "CANCELLED") {
        throw new ApiError(400, "Top up is already cancelled");
      }

      const topUpBank = await tx.topUpBank.findUnique({
        where: { id: "TOPUP_BANK", company_id: meta.company_id }
      });

      if (!topUpBank || new Prisma.Decimal(topUpBank.available_balance).lt(existingTopUp.amount)) {
        throw new ApiError(400, "Cannot cancel TopUp: Operational float has already been allocated to users and available balance in TopUp Bank is too low.");
      }

      const cancelTopUp = await tx.topUp.update({
        where: {
          id
        },
        data: {
          status: "CANCELLED"
        }
      });

      await tx.topUpBank.update({
        where: {
          id: "TOPUP_BANK",
          company_id: meta.company_id,
        },
        data: {
          available_balance: {
            decrement: existingTopUp.amount
          }
        }
      });

      await tx.companyFloat.update({
        where: {
          id: "COMPANY_ACCOUNT",
          company_id: meta.company_id,
        },
        data: {
          available_balance: {
            increment: existingTopUp.amount
          }
        }
      });

      await tx.float_Ledger.create({
        data: {
          company_id: meta.company_id,
          account_id: "TOPUP_BANK",
          account_type: "TOPUP_BANK",
          amount: existingTopUp.amount,
          entry_type: "DEBIT",
          reference_type: "TOP_UP_DELETION",
          reference_id: existingTopUp.id,
          description: "Top up deleted - withdrawn from TopUp Bank",
        }
      });

      await tx.float_Ledger.create({
        data: {
          company_id: meta.company_id,
          account_id: "COMPANY_ACCOUNT",
          account_type: "COMPANY",
          amount: existingTopUp.amount,
          entry_type: "CREDIT",
          reference_type: "TOP_UP_DELETION",
          reference_id: existingTopUp.id,
          description: "Top up deleted - returned to Company Float",
        }
      });

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
      });

      return cancelTopUp;
    });

    return {
      success: true,
      message: "Top up deleted successfully",
    };
  } catch (error) {
    console.log("error in deleting top up  ", error);
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