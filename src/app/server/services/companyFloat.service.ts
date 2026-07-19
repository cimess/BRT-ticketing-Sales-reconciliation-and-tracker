import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/ApiError";

export async function creditCompanyFloat(
  data: { amount: number; note?: string },
  meta: { ip: string; user: { id: string; role: string; company_id: string } }
) {
  try {
    const { amount, note } = data;
    const { ip, user } = meta;

    if (amount <= 0) {
      throw new ApiError(400, "Amount must be greater than 0");
    }

    const result = await prisma.$transaction(async (tx) => {
      const companyFloat = await tx.companyFloat.findUnique({
        where: { id: "COMPANY_ACCOUNT", company_id: user.company_id }
      });

      const currentBalance = companyFloat ? Number(companyFloat.available_balance) : 0;

      const updatedCompanyFloat = await tx.companyFloat.upsert({
        where: { id: "COMPANY_ACCOUNT", company_id: user.company_id },
        create: {
          id: "COMPANY_ACCOUNT",
          company_id: user.company_id,
          available_balance: amount
        },
        update: {
          available_balance: {
            increment: amount
          }
        }
      });

      await tx.float_Ledger.create({
        data: {
          company_id: user.company_id,
          account_id: "COMPANY_ACCOUNT",
          account_type: "COMPANY",
          amount,
          entry_type: "CREDIT",
          reference_type: "COMPANY_DEPOSIT",
          reference_id: "SYSTEM",
          description: note || "Company Float credited by Admin"
        }
      });

      await tx.auditLog.create({
        data: {
          company_id: user.company_id,
          user_id: user.id,
          action: "UPDATE",
          entity_type: "USER",
          entity_id: user.id,
          before_state: { available_balance: currentBalance },
          after_state: { available_balance: Number(updatedCompanyFloat.available_balance) },
          meta: {
            source: "admin dashboard(web)",
            ip,
            note: note || "Manual company float credit"
          }
        }
      });

      return updatedCompanyFloat;
    });

    return {
      success: true,
      message: "Company float credited successfully",
      balance: Number(result.available_balance)
    };
  } catch (error) {
    console.error("error in crediting company float", error);
    throw error instanceof ApiError ? error : new ApiError(500, "Internal server error");
  }
}

export async function debitCompanyFloat(
  data: { amount: number; note?: string },
  meta: { ip: string; user: { id: string; role: string; company_id: string } }
) {
  try {
    const { amount, note } = data;
    const { ip, user } = meta;

    if (amount <= 0) {
      throw new ApiError(400, "Amount must be greater than 0");
    }

    const result = await prisma.$transaction(async (tx) => {
      const companyFloat = await tx.companyFloat.findUnique({
        where: { id: "COMPANY_ACCOUNT", company_id: user.company_id }
      });

      if (!companyFloat || new Prisma.Decimal(companyFloat.available_balance).lt(amount)) {
        throw new ApiError(400, "Insufficient company float available to deduct.");
      }

      const currentBalance = Number(companyFloat.available_balance);

      const updatedCompanyFloat = await tx.companyFloat.update({
        where: { id: "COMPANY_ACCOUNT", company_id: user.company_id },
        data: {
          available_balance: {
            decrement: amount
          }
        }
      });

      await tx.float_Ledger.create({
        data: {
          company_id: user.company_id,
          account_id: "COMPANY_ACCOUNT",
          account_type: "COMPANY",
          amount,
          entry_type: "DEBIT",
          reference_type: "COMPANY_WITHDRAWAL",
          reference_id: "SYSTEM",
          description: note || "Company Float debited by Admin"
        }
      });

      await tx.auditLog.create({
        data: {
          company_id: user.company_id,
          user_id: user.id,
          action: "UPDATE",
          entity_type: "USER",
          entity_id: user.id,
          before_state: { available_balance: currentBalance },
          after_state: { available_balance: Number(updatedCompanyFloat.available_balance) },
          meta: {
            source: "admin dashboard(web)",
            ip,
            note: note || "Manual company float debit"
          }
        }
      });

      return updatedCompanyFloat;
    });

    return {
      success: true,
      message: "Company float debited successfully",
      balance: Number(result.available_balance)
    };
  } catch (error) {
    console.error("error in debiting company float", error);
    throw error instanceof ApiError ? error : new ApiError(500, "Internal server error");
  }
}

export async function recordCompanyExpense(
  data: { amount: number; note: string },
  meta: { ip: string; user: { id: string; role: string; company_id: string } }
) {
  try {
    const { amount, note } = data;
    const { ip, user } = meta;

    if (amount <= 0) {
      throw new ApiError(400, "Amount must be greater than 0");
    }
    if (!note || note.trim().length === 0) {
      throw new ApiError(400, "Expense note/description is required");
    }

    const result = await prisma.$transaction(async (tx) => {
      const companyFloat = await tx.companyFloat.findUnique({
        where: { id: "COMPANY_ACCOUNT", company_id: user.company_id }
      });

      if (!companyFloat || new Prisma.Decimal(companyFloat.available_balance).lt(amount)) {
        throw new ApiError(400, "Insufficient company float available to record this expense.");
      }

      const currentBalance = Number(companyFloat.available_balance);

      const updatedCompanyFloat = await tx.companyFloat.update({
        where: { id: "COMPANY_ACCOUNT", company_id: user.company_id },
        data: {
          available_balance: {
            decrement: amount
          }
        }
      });

      await tx.float_Ledger.create({
        data: {
          company_id: user.company_id,
          account_id: "COMPANY_ACCOUNT",
          account_type: "COMPANY",
          amount,
          entry_type: "DEBIT",
          reference_type: "COMPANY_EXPENSE",
          reference_id: "SYSTEM",
          description: note
        }
      });

      await tx.auditLog.create({
        data: {
          company_id: user.company_id,
          user_id: user.id,
          action: "UPDATE",
          entity_type: "USER",
          entity_id: user.id,
          before_state: { available_balance: currentBalance },
          after_state: { available_balance: Number(updatedCompanyFloat.available_balance) },
          meta: {
            source: "admin dashboard(web)",
            ip,
            note: `Recorded company expense: ${note}`
          }
        }
      });

      return updatedCompanyFloat;
    });

    return {
      success: true,
      message: "Company expense recorded successfully",
      balance: Number(result.available_balance)
    };
  } catch (error) {
    console.error("error in recording company expense", error);
    throw error instanceof ApiError ? error : new ApiError(500, "Internal server error");
  }
}

export async function reverseCompanyFloatAdjustment(
  data: { ledgerId: string },
  meta: { ip: string; user: { id: string; role: string; company_id: string } }
) {
  try {
    const { ledgerId } = data;
    const { ip, user } = meta;

    const result = await prisma.$transaction(async (tx) => {
      const ledgerEntry = await tx.float_Ledger.findUnique({
        where: { id: ledgerId, company_id: user.company_id }
      });

      if (!ledgerEntry) {
        throw new ApiError(404, "Ledger entry not found.");
      }

      if (ledgerEntry.account_id !== "COMPANY_ACCOUNT" || ledgerEntry.account_type !== "COMPANY") {
        throw new ApiError(400, "Can only reverse manual company float adjustments.");
      }

      if (
        ledgerEntry.reference_type !== "COMPANY_DEPOSIT" &&
        ledgerEntry.reference_type !== "COMPANY_WITHDRAWAL" &&
        ledgerEntry.reference_type !== "COMPANY_EXPENSE"
      ) {
        throw new ApiError(
          400,
          "Only COMPANY_DEPOSIT, COMPANY_WITHDRAWAL, or COMPANY_EXPENSE ledger entries can be reversed."
        );
      }

      const alreadyReversed = await tx.float_Ledger.findFirst({
        where: {
          company_id: user.company_id,
          reference_type: "COMPANY_ADJUSTMENT_REVERSAL",
          reference_id: ledgerId
        }
      });

      if (alreadyReversed) {
        throw new ApiError(400, "This adjustment has already been reversed.");
      }

      const companyFloat = await tx.companyFloat.findUnique({
        where: { id: "COMPANY_ACCOUNT", company_id: user.company_id }
      });

      const currentBalance = companyFloat ? Number(companyFloat.available_balance) : 0;
      const amount = Number(ledgerEntry.amount);

      let updatedCompanyFloat;

      if (ledgerEntry.reference_type === "COMPANY_DEPOSIT") {
        if (currentBalance < amount) {
          throw new ApiError(
            400,
            `Cannot reverse deposit: insufficient float balance. Current balance: ₦${currentBalance.toLocaleString()}, required: ₦${amount.toLocaleString()}.`
          );
        }

        updatedCompanyFloat = await tx.companyFloat.update({
          where: { id: "COMPANY_ACCOUNT", company_id: user.company_id },
          data: {
            available_balance: {
              decrement: amount
            }
          }
        });

        await tx.float_Ledger.create({
          data: {
            company_id: user.company_id,
            account_id: "COMPANY_ACCOUNT",
            account_type: "COMPANY",
            amount,
            entry_type: "DEBIT",
            reference_type: "COMPANY_ADJUSTMENT_REVERSAL",
            reference_id: ledgerId,
            description: `Reversal of Deposit (Ledger ID: ${ledgerId})`
          }
        });
      } else {
        updatedCompanyFloat = await tx.companyFloat.upsert({
          where: { id: "COMPANY_ACCOUNT", company_id: user.company_id },
          create: {
            id: "COMPANY_ACCOUNT",
            company_id: user.company_id,
            available_balance: amount
          },
          update: {
            available_balance: {
              increment: amount
            }
          }
        });

        const actionName = ledgerEntry.reference_type === "COMPANY_EXPENSE" ? "Expense" : "Withdrawal";
        await tx.float_Ledger.create({
          data: {
            company_id: user.company_id,
            account_id: "COMPANY_ACCOUNT",
            account_type: "COMPANY",
            amount,
            entry_type: "CREDIT",
            reference_type: "COMPANY_ADJUSTMENT_REVERSAL",
            reference_id: ledgerId,
            description: `Reversal of ${actionName} (Ledger ID: ${ledgerId})`
          }
        });
      }

      await tx.auditLog.create({
        data: {
          company_id: user.company_id,
          user_id: user.id,
          action: "UPDATE",
          entity_type: "USER",
          entity_id: user.id,
          before_state: { available_balance: currentBalance },
          after_state: { available_balance: Number(updatedCompanyFloat.available_balance) },
          meta: {
            source: "admin dashboard(web)",
            ip,
            note: `Reversed ledger entry ${ledgerId}`
          }
        }
      });

      return updatedCompanyFloat;
    });

    return {
      success: true,
      message: "Adjustment reversed successfully",
      balance: Number(result.available_balance)
    };
  } catch (error) {
    console.error("error in reversing company float adjustment", error);
    throw error instanceof ApiError ? error : new ApiError(500, "Internal server error");
  }
}
