-- This is an empty migration.

-- 1. Optimize Fillfactor to leave 15% free space in pages for Heap-Only Tuple (HOT) updates
ALTER TABLE "Remittance" SET (fillfactor = 85);
ALTER TABLE "RemittanceExpectation" SET (fillfactor = 85);
ALTER TABLE "PosDeviceSession" SET (fillfactor = 85);
ALTER TABLE "Float_Ledger" SET (fillfactor = 95); -- Append-only table, only needs minor headroom

-- 2. Force a rebuild of existing tables to apply the new fillfactor (optional but recommended)
VACUUM FULL "Remittance";
VACUUM FULL "RemittanceExpectation";
VACUUM FULL "PosDeviceSession";
VACUUM FULL "Float_Ledger";

-- 3. Tune Table-Level Autovacuum to clean up dead tuples more aggressively
ALTER TABLE "Remittance" SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 50,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_analyze_threshold = 25
);

ALTER TABLE "RemittanceExpectation" SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 50,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_analyze_threshold = 25
);
