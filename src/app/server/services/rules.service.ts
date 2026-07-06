// Replace rules.service.ts contents with:

import { prisma } from "@/app/lib/prisma";

export const DEFAULT_RULES = [
  {
    name: "Late Report Submission Policy",
    description: "Fines ticketers who submit reports late after shift closing time.",
    comparison_value: 2.0,
    fine_amount: 500.0,
  },
  {
    name: "Shortage Remittance Policy",
    description: "Fines ticketers when remittance expectation is overdue.",
    comparison_value: 24.0,
    fine_amount: 1000.0,
  },
  {
    name: "Late Bank Deposit Policy",
    description: "Fines supervisors who delay depositing accepted cash.",
    comparison_value: 24.0,
    fine_amount: 1000.0,
  },
  {
    name: "Supervisor Fine Authority Policy",
    description: "Allows supervisors to manually issue fines, waive, and edit fine amounts.",
    comparison_value: 1.0,
    fine_amount: 0.0,
  }
];

/**
 * Ensures all default rules are created for a specific company (Optimized to 1 DB call)
 */
export async function ensureCompanyRules(companyId: string) {
  // 1. Fetch all existing rules for this company in a single quick call
  const existingRules = await prisma.companyRule.findMany({
    where: { company_id: companyId },
    select: { name: true }
  });

  const existingNames = new Set(existingRules.map(r => r.name));
  
  // 2. Filter out what is missing in memory
  const missingRules = DEFAULT_RULES.filter(r => !existingNames.has(r.name));

  // 3. Only hit the database to write if something is actually missing
  if (missingRules.length > 0) {
    await prisma.companyRule.createMany({
      data: missingRules.map(defaultRule => ({
        ...defaultRule,
        company_id: companyId,
        is_active: defaultRule.name === "Supervisor Fine Authority Policy" ? false : true,
      }))
    });
    console.log(`[Rules Seeding] Bulk created ${missingRules.length} missing default rules for company ${companyId}`);
  }
}


export async function ensureDefaultRules() {
  try {
    const companies = await prisma.company.findMany({ select: { id: true } });
    
    for (const company of companies) {
      await ensureCompanyRules(company.id);
    }
  } catch (error) {
    console.error("[Rules Startup] Error ensuring default rules:", error);
  }
}

/**
 * Helper to check if supervisors are authorized to issue, edit, or waive fines.
 */
export async function checkSupervisorFinePermission(companyId: string): Promise<boolean> {
  const permission = await prisma.companyRule.findFirst({
    where: {
      company_id: companyId,
      name: "Supervisor Fine Authority Policy",
      is_active: true,
    },
  });
  return !!permission;
}
