export type DashboardRoleUsers = 'TICKETER' | 'SUPERVISOR' | 'ADMIN' | 'AUDITOR';

export const DASHBOARD_ROLES: DashboardPageRole[] = [
  'ticketer', 'supervisor', 'admin', 'auditor'
];

export type DashboardPageRole = 'ticketer' | 'supervisor' | 'admin' | 'auditor';

export function isDashboardRole(value: unknown): value is DashboardPageRole {
  return typeof value === 'string' && (DASHBOARD_ROLES as readonly string[]).includes(value);
}

export type Status = 'MATCHED' | 'VARIANCE' | 'PENDING' | 'INVESTIGATING' | 'RESOLVED';

export type ReconciliationScope = 'TICKETER' | 'SUPERVISOR' | 'ADMIN';


export type Float_Status = 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'ADJUSTED' | 'ALL'
export type TopUp_Source = 'COMPANY_RESERVE' | 'GOVERNMENT_TOP_UP' | 'EXTERNAL_OTHER_SOURCE'

export interface ReconciliationRun {
  run_id: string;
  expected_float: number;
  actual_remittance: number;
  variance: number;
  date: string;
  scope: ReconciliationScope;
  status: Status; // OK/WARN/FAIL
  actor: User["fullname"]
  generated_at: string;
}



export interface AddTopUp {
  id?: string
  amount: number
  allocated_from: TopUp_Source
  allocationNote: string
}

export interface ReverseTopUp {
  id: string
  company_float_id: string
  user: { id: string, fullname: string, role: DashboardRoleUsers }
}

export interface SystemNotification {
  id: string;
  company_id: string;
  user_id: string;
  message: string;
  type: string | null;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}


export interface Float_Alocation {
  id: string
  from_user: User["fullname"]
  to_user: User["fullname"]
  top_up_id: AddTopUp["id"]
  to_role: User["role"]
  from_role: User["role"]
  pre_allocation_float?: number
  amount_allocated: number
  amount_remaining: number
  allocated_at: string
  status: 'SUCCESS' | 'ADJUSTED' | 'CANCELLED'
}


export interface FloatLedgerEntry {
  id: string
  user: User["fullname"]
  amount: number
  entry_type: 'CREDIT' | 'DEBIT'
  display_status?: string
  description: string
  created_at: string
}
export interface Fine {
  id: string
  defaulter_id: User["fullname"]
  amount: number
  reason: string
  issued_by: User["fullname"]
  status: 'UNPAID' | 'PAID'
  created_at: string;
}

export interface Location {
  id: string
  name: string
  address: string
  created_at: string;
}
export interface Ticketer_Location_Assignment {
  id: string
  assignmentId: string
  locationId?: string
  locationName: string
  locationAddress: string
  assignedFor: string
}
export interface Remittance {
  id: string
  remit_id: string;
  method: 'CASH' | 'TRANSFER';
  amount: number;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'PENDING_SUPERVISOR_ACCEPTANCE' | 'ACCEPTED_BY_SUPERVISOR' | 'REJECTED_BY_SUPERVISOR' | 'DEPOSITED';
  proof_ref?: string;
  submitted_at: string;
  verified_at?: string;
  pos_id?: string | null;
  pos_name?: string | null;
  submitted_by: User["fullname"]
  verified_by?: User["fullname"]
  received_by_supervisor?: User["fullname"] | null;
  remittance_date: string;
  created_at: string;
  ticketer_outstanding?: number;
  is_reconciliation?: boolean;
  receipt_images?: string[];
}

export interface Sales_Record {
  id: string
  ticketer_id: string
  user_name: string
  pos_session_id: string
  location_id: string
  opening_balance: number
  closing_balance: number
  top_up: number
  total_sold: number
  report_date: string
  submitted_at: string
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'CANCELLED'
}

export interface Commission_Rate {
  id: string
  role: DashboardRoleUsers
  percentage: number
  fixed_amount: number
  created_at: string
}

export interface CommissionRecord {
  id: string
  user_id: string
  user_name: string
  period_start: string
  period_end: string
  total_sales: number
  fines_deducted: number
  net_pay?: number
  status: 'PENDING' | 'PAID'
  created_at: string
}
export interface SupervisorCommissionRecord {
  id: string
  user_id: string
  user_name: string
  period_start: string
  period_end: string
  tickter_total_sales: number
  fines_deducted: number
  net_pay?: number
  status: 'PENDING' | 'PAID'
  created_at: string
}

export interface PosDevice {
  id: string
  serial_number: string
  name: string
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'
  created_at: string
}

export interface PosDeviceEvent {
  id: string
  user_id: string
  username: string
  assigned_at: string
  unassigned_at?: string
  assigned_by: string
  unassigned_by?: string
  unassigned_reason?: string
  status: 'ACTIVE' | 'RETURNED' | 'SHARED' | 'CLOSED'

}



export interface AuditLogEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  actor: string;
  created_at: string;
  meta?: { ip?: string; device?: string };
  before?: unknown;
  after?: unknown;
}

export interface ReportRecord {
  report_id: string;
  name: string;
  period: string;
  status: 'READY' | 'RUNNING' | 'FAILED';
  created_at: string;
  created_by: string;
}

export interface User_Full_Audit {
  user_id: string;
  username: string;
  guarantor: string | null;
  guarantor_phone: string | null;
  guarantor_address: string | null;
  role: DashboardRoleUsers;
  created_at: string;
  address?: string;
  supervisor?: string;
  phone?: string;
  email: string;
  fines?: Fine[];
  remitance?: Remittance[];
  reconciliation?: ReconciliationRun[];
  locations?: Ticketer_Location_Assignment[];
  restricted?: boolean;

}



export interface User {
  id: string;
  user_id?: string;
  username?: string;
  fullname?: string;
  first_name?: string;
  last_name?: string;
  guarantor: string | null;
  guarantor_phone: string | null;
  guarantor_address: string | null;
  role?: DashboardRoleUsers;
  created_at?: string;
  address?: string;
  supervisor?: string;
  phone?: string;
  email: string;
}

export interface supervisor_user {
  user_id: string;
  username: string;
  guarantor: string | null;
  guarantor_phone: string | null;
  guarantor_address: string | null;
  created_at: string;
  address?: string;
  phone?: string;
  email: string;
  fines?: number[];
  locations?: string[];
  remitance?: Remittance[];
  reconciliation?: ReconciliationRun[];
  active_allocations?: number;
  active_device?: string;
  total_sales: number;
  last_login: string;
}


export type RemittanceExpectationStatus = 'PENDING' | 'SUBMITTED' | 'OVERDUE' | 'VIOLATED' | 'PAID';
export type ReconciliationMethod = 'CASH' | 'TRANSFER';
export type RemittanceVerifyAction = 'VERIFY' | 'REJECT';

export interface UserSummary {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: 'TICKETER' | 'SUPERVISOR' | 'ADMIN' | 'AUDITOR';
}

export interface PosSessionSummary {
  id: string;
  device?: {
    name: string;
  } | null;
}

export interface RemittanceExpectation {
  id: string;
  company_id: string;
  user_id: string;
  pos_session_id: string | null;
  source_remittance_id: string | null;
  expected_amount: number;
  shortage_amount: number;
  due_date: string;
  status: RemittanceExpectationStatus;
  created_at: string;
  updated_at?: string;
  user: UserSummary;
  pos_session?: PosSessionSummary | null;
}

export interface ReconciliationRemittance {
  id: string;
  company_id: string;
  submitted_by: string;
  amount: number;
  method: ReconciliationMethod;
  payment_reference: string | null;
  remittance_date: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'PENDING_SUPERVISOR_ACCEPTANCE' | 'ACCEPTED_BY_SUPERVISOR' | 'REJECTED_BY_SUPERVISOR'
  | 'DEPOSITED';
  pos_session_id: string | null;
  received_by_supervisor_id: string | null;
  created_at: string;
  ticketer: UserSummary;
  pos_session?: PosSessionSummary | null;
  receipt_images?: string[];
}

export interface ReconcileApiResponse {
  success: boolean;
  expectations: RemittanceExpectation[];
  remittances: ReconciliationRemittance[];
  supervisorCanFine: boolean;
  error?: string;
}
