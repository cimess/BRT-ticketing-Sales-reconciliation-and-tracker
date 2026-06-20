// prisma/seed.js
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

// Determine environment database source
const isProd = process.env.NODE_ENV === "production";
const datasource = isProd
  ? process.env.DATABASE_URL
  : process.env.LOCAL_DATABASE_URL;

// Create database pool
const pool = new Pool({
  connectionString: datasource,
  ssl: isProd ? { rejectUnauthorized: false } : false,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🚀 Starting database seeding & multi-tenant migration...");

  // 1. Create or Find the Default Company
  let company = await prisma.company.findFirst({
    where: { code: 'BRT' }
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'Oteben Transport Services',
        code: 'BRT'
      }
    });
    console.log(`✅ Created default company: ${company.name} (${company.code})`);
  } else {
    console.log(`ℹ️ Found existing default company: ${company.name}`);
  }

  const companyId = company.id;

  // 2. Create the CompanyFloat record for this company if it doesn't exist
  const existingFloat = await prisma.companyFloat.findFirst({
    where: { company_id: companyId }
  });

  if (!existingFloat) {
    await prisma.companyFloat.create({
      data: {
        company_id: companyId,
        available_balance: 0.00
      }
    });
    console.log("✅ Created default company float balance record.");
  }


  // 3. Update all existing data records to associate with this company
  const updatePromises = [
    { name: 'User', action: () => prisma.user.updateMany({ data: { company_id: companyId } }) },
    { name: 'RegistrationToken', action: () => prisma.registrationToken.updateMany({ data: { company_id: companyId } }) },
    { name: 'Float_allocations', action: () => prisma.float_allocations.updateMany({ data: { company_id: companyId } }) },
    { name: 'Remittance', action: () => prisma.remittance.updateMany({ data: { company_id: companyId } }) },
    { name: 'RemittanceExpectation', action: () => prisma.remittanceExpectation.updateMany({ data: { company_id: companyId } }) },
    { name: 'Float_Ledger', action: () => prisma.float_Ledger.updateMany({ data: { company_id: companyId } }) },
    { name: 'Pos_devices', action: () => prisma.pos_devices.updateMany({ data: { company_id: companyId } }) },
    { name: 'PosDeviceSession', action: () => prisma.posDeviceSession.updateMany({ data: { company_id: companyId } }) },
    { name: 'SalesReport', action: () => prisma.salesReport.updateMany({ data: { company_id: companyId } }) },
    { name: 'Location', action: () => prisma.location.updateMany({ data: { company_id: companyId } }) },
    { name: 'TopUp', action: () => prisma.topUp.updateMany({ data: { company_id: companyId } }) },
    { name: 'Reconciliation_reports', action: () => prisma.reconciliation_reports.updateMany({ data: { company_id: companyId } }) },
    { name: 'AuditLog', action: () => prisma.auditLog.updateMany({ data: { company_id: companyId } }) },
    { name: 'Commission_rules', action: () => prisma.commission_rules.updateMany({ data: { company_id: companyId } }) },
    { name: 'CommissionEarning', action: () => prisma.commissionEarning.updateMany({ data: { company_id: companyId } }) },
    { name: 'Fine', action: () => prisma.fine.updateMany({ data: { company_id: companyId } }) },
    { name: 'Ticketer_Location_Assignment', action: () => prisma.ticketer_Location_Assignment.updateMany({ data: { company_id: companyId } }) },
  ];


  for (const update of updatePromises) {
    try {
      const result = await update.action();
      console.log(`👉 Updated ${update.name} records: ${result.count}`);
    } catch (err) {
      console.log(`⚠️ Skipped/Failed updating ${update.name}: ${err.message}`);
    }
  }

  console.log("🎉 Database seeding and data mapping completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end(); // close db pool connection
  });
