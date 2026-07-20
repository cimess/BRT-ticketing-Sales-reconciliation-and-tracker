// scripts/test-export.ts
import { exportTablesToR2 } from "../src/app/workers/backupWorker";

async function main() {
  console.log("--- Starting manual database table export to R2 (Dev Mode) ---");
  try {
    await exportTablesToR2();
    console.log("--- Export completed successfully! ---");
  } catch (error) {
    console.error("--- Export failed ---", error);
  }
}

main();
