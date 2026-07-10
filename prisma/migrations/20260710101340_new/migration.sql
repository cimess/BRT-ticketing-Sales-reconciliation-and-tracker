-- CreateIndex
CREATE INDEX "AuditLog_company_id_created_at_idx" ON "AuditLog"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "CommissionEarning_company_id_user_id_idx" ON "CommissionEarning"("company_id", "user_id");

-- CreateIndex
CREATE INDEX "CommissionEarning_company_id_created_at_idx" ON "CommissionEarning"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "Commission_rules_company_id_is_active_idx" ON "Commission_rules"("company_id", "is_active");

-- CreateIndex
CREATE INDEX "CompanyRule_company_id_name_is_active_idx" ON "CompanyRule"("company_id", "name", "is_active");

-- CreateIndex
CREATE INDEX "Fine_company_id_defaulter_id_status_idx" ON "Fine"("company_id", "defaulter_id", "status");

-- CreateIndex
CREATE INDEX "Fine_company_id_status_created_at_idx" ON "Fine"("company_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "Float_Ledger_company_id_account_id_account_type_idx" ON "Float_Ledger"("company_id", "account_id", "account_type");

-- CreateIndex
CREATE INDEX "Float_Ledger_company_id_posSession_reference_type_idx" ON "Float_Ledger"("company_id", "posSession", "reference_type");

-- CreateIndex
CREATE INDEX "Float_Ledger_company_id_created_at_idx" ON "Float_Ledger"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "Float_allocations_company_id_from_user_status_idx" ON "Float_allocations"("company_id", "from_user", "status");

-- CreateIndex
CREATE INDEX "Float_allocations_company_id_pos_device_id_status_idx" ON "Float_allocations"("company_id", "pos_device_id", "status");

-- CreateIndex
CREATE INDEX "Float_allocations_company_id_allocated_at_idx" ON "Float_allocations"("company_id", "allocated_at");

-- CreateIndex
CREATE INDEX "Location_company_id_idx" ON "Location"("company_id");

-- CreateIndex
CREATE INDEX "PosDeviceSession_company_id_user_id_status_idx" ON "PosDeviceSession"("company_id", "user_id", "status");

-- CreateIndex
CREATE INDEX "PosDeviceSession_company_id_device_id_status_idx" ON "PosDeviceSession"("company_id", "device_id", "status");

-- CreateIndex
CREATE INDEX "Reconciliation_reports_company_id_generated_at_idx" ON "Reconciliation_reports"("company_id", "generated_at");

-- CreateIndex
CREATE INDEX "Remittance_company_id_status_idx" ON "Remittance"("company_id", "status");

-- CreateIndex
CREATE INDEX "Remittance_company_id_submitted_by_created_at_idx" ON "Remittance"("company_id", "submitted_by", "created_at");

-- CreateIndex
CREATE INDEX "Remittance_company_id_pos_session_id_status_idx" ON "Remittance"("company_id", "pos_session_id", "status");

-- CreateIndex
CREATE INDEX "Remittance_company_id_received_by_supervisor_id_status_idx" ON "Remittance"("company_id", "received_by_supervisor_id", "status");

-- CreateIndex
CREATE INDEX "RemittanceExpectation_company_id_status_idx" ON "RemittanceExpectation"("company_id", "status");

-- CreateIndex
CREATE INDEX "RemittanceExpectation_company_id_user_id_status_idx" ON "RemittanceExpectation"("company_id", "user_id", "status");

-- CreateIndex
CREATE INDEX "SalesReport_company_id_ticketer_id_status_idx" ON "SalesReport"("company_id", "ticketer_id", "status");

-- CreateIndex
CREATE INDEX "SalesReport_company_id_pos_session_id_status_idx" ON "SalesReport"("company_id", "pos_session_id", "status");

-- CreateIndex
CREATE INDEX "SalesReport_company_id_submitted_at_idx" ON "SalesReport"("company_id", "submitted_at");

-- CreateIndex
CREATE INDEX "SalesReport_company_id_ticketer_id_verified_at_idx" ON "SalesReport"("company_id", "ticketer_id", "verified_at");

-- CreateIndex
CREATE INDEX "Ticketer_Location_Assignment_company_id_user_id_assigned_fo_idx" ON "Ticketer_Location_Assignment"("company_id", "user_id", "assigned_for");

-- CreateIndex
CREATE INDEX "TopUp_company_id_date_received_idx" ON "TopUp"("company_id", "date_received");

-- CreateIndex
CREATE INDEX "User_company_id_supervisor_id_idx" ON "User"("company_id", "supervisor_id");

-- CreateIndex
CREATE INDEX "User_company_id_role_idx" ON "User"("company_id", "role");
