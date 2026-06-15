export type DashboardRoleUsers = 'TICKETER' | 'SUPERVISOR' | 'ADMIN' |  'AUDITOR';

export const DASHBOARD_ROLES: DashboardPageRole[] = [
 'ticketer' , 'supervisor' , 'admin' ,  'auditor'
];

export type DashboardPageRole = 'ticketer' | 'supervisor' | 'admin' |  'auditor';

export function isDashboardRole(value: unknown): value is DashboardPageRole {
  return typeof value === 'string' && (DASHBOARD_ROLES as readonly string[]).includes(value);
}

export type Status = 'MATCHED' | 'VARIANCE' | 'PENDING' | 'INVESTIGATING' | 'RESOLVED';

export type ReconciliationScope = 'TICKETER' | 'SUPERVISOR' | 'ADMIN';


export type Float_Status = 'SUCCESS'|'FAILED'|'CANCELLED' |'ADJUSTED'|'ALL'
export type  TopUp_Source = 'COMPANY_RESERVE' | 'GOVERNMENT_TOP_UP' | 'EXTERNAL_OTHER_SOURCE'

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
  user:{id:string,fullname:string,role:DashboardRoleUsers}
}



export interface Float_Alocation {  
  id: string   
  from_user: User["fullname"]
  to_user: User["fullname"]
  top_up_id: AddTopUp["id"]
  to_role:User["role"]
  from_role:User["role"]
  
  amount_allocated: number
  amount_remaining: number
  allocated_at: string
  status           : 'SUCCESS'|'ADJUSTED'|'CANCELLED' 
  }


export interface FloatLedgerEntry {
  id: string    
  user: User["fullname"]
  amount: number
  entry_type: 'CREDIT' | 'DEBIT'
  description: string
  created_at: string
}
export interface Fine{
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
  user_id: User["fullname"]
  location_id: string

  assigned_for: string

  created_at: string
}
export interface Remittance {
  id: string
  remit_id: string;
  method: 'CASH' | 'TRANSFER';
  amount: number;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED'| 'CANCELLED';
  proof_ref?: string;
  submitted_at: string;
  verified_at?: string;
  submitted_by: User["fullname"]
  verified_by?: User["fullname"]
  received_by_supervisor?: User["fullname"] | null;
  remittance_date: string;
  created_at: string;
}

export interface Sales_Record {
  id:string           
  ticketer_id:string
  user_name:string
  pos_session_id:string
  location_id:string
  opening_balance:number
  closing_balance:number
  top_up:number
  total_sold:number
  report_date:string
  submitted_at:string
}

export interface Commission_Rate {
  id: string  
  role: DashboardRoleUsers
  percentage: number
  fixed_amount: number
  created_at: string
}

export interface CommissionRecord {
  id:string  
  user_id:string     
  user_name:string
  period_start:string
  period_end:string
  total_sales:number
  fines_deducted:number
  net_pay?:number
  status:'PENDING' | 'PAID'
  created_at:string
}
export interface SupervisorCommissionRecord {
  id:string  
  user_id:string     
  user_name:string
  period_start:string
  period_end:string
  tickter_total_sales:number
  fines_deducted:number
  net_pay?:number
  status:'PENDING' | 'PAID'
  created_at:string
}

export interface PosDevice{
  id:string           
  serial_number:string
  name:string
  status:'ACTIVE'|'INACTIVE'|'MAINTENANCE'
  created_at:string
}

export interface PosDeviceEvent {
  id                :string           
  user_id           :string
  username           :string
  assigned_at       :string          
  unassigned_at?    :string
  assigned_by       :string
  unassigned_by?    :string
  unassigned_reason?: string
  status            :'ACTIVE'|'RETURNED'
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
  guarantor: string|null;
  guarantor_phone: string|null;
  guarantor_address: string|null;
  role: DashboardRoleUsers;
  created_at: string;
  address?: string;
  supervisor?: string;
  phone?: string;
  email: string;
  fines?: Fine[];
  remitance?:Remittance[];
  reconciliation?:ReconciliationRun[]; 
  locations?: Ticketer_Location_Assignment[];
  // active_allocations?: number;
  // active_device?: string;
  // total_sales: number;
  // last_login: string;

}



export interface User {
  id: string;
  fullname?: string;
  first_name?: string;
  last_name?: string;
  guarantor: string|null;
  guarantor_phone: string|null;
  guarantor_address: string|null;
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
  guarantor: string|null;
  guarantor_phone: string|null;
  guarantor_address: string|null;
  created_at: string;
  address?: string;
  phone?: string;
  email: string;
  fines?: number[];
  locations?: string[];
  remitance?:Remittance[];
  reconciliation?:ReconciliationRun[];
  active_allocations?: number;
  active_device?: string;
  total_sales: number;
  last_login: string;
}