export type ModuleKey =
  | 'overview'
  | 'reconciliation'
  | 'float'
  | 'sales'
  | 'transactions'
  | 'remittances'
  | 'commission'
  | 'pos'
  | 'audit'
  | 'reports'
  | 'admin_users'
  | 'admin_roles'
  | 'location';

export type Role = 'ticketer' | 'supervisor' | 'admin' | 'auditor';

export interface ModuleItem {
  key: ModuleKey;
  label: string;
  path: string; // path part after /dashboard/:role/
  group: 'Operations' | 'Reconciliation' | 'Earnings' | 'Devices' | 'Audit' | 'Reports' | 'Admin';
  roles: Role[];
}

export const MODULES: ModuleItem[] = [
  { key: 'overview', label: 'Overview', path: '/', group: 'Operations', roles: ['ticketer', 'supervisor', 'admin', 'auditor'] },

  { key: 'reconciliation', label: 'Reconciliation', path: 'reconciliation', group: 'Reconciliation', roles: ['ticketer', 'supervisor', 'admin', 'auditor'] },

  { key: 'float', label: 'Float Ledger', path: 'float', group: 'Operations', roles: ['ticketer', 'supervisor', 'admin', 'auditor'] },

  { key: 'sales', label: 'Sales', path: 'sales', group: 'Earnings', roles: ['ticketer', 'supervisor', 'admin'] },

  { key: 'transactions', label: 'Transactions', path: 'transactions', group: 'Operations', roles: ['ticketer', 'supervisor', 'admin', 'auditor'] },

  { key: 'remittances', label: 'Remittances', path: 'remittances', group: 'Operations', roles: ['ticketer', 'supervisor', 'admin', 'auditor'] },

  { key: 'commission', label: 'Commission', path: 'commision', group: 'Earnings', roles: ['ticketer', 'supervisor', 'admin', 'auditor'] },

  { key: 'pos', label: 'POS Devices', path: 'devices', group: 'Devices', roles: ['supervisor', 'admin', 'auditor', 'ticketer'] },

  { key: 'audit', label: 'Audit Logs', path: 'audit', group: 'Audit', roles: ['supervisor', 'admin', 'auditor'] },

  { key: 'reports', label: 'Reports', path: 'reports', group: 'Reports', roles: ['supervisor', 'admin', 'auditor'] },
  
  { key: 'location', label: 'Locations', path: 'locations', group: 'Operations', roles: ['admin', 'supervisor', 'ticketer'] },

  { key: 'admin_users', label: 'Users', path: 'users', group: 'Admin', roles: ['admin'] },

  { key: 'admin_roles', label: 'Roles & Permissions', path: 'roles', group: 'Admin', roles: ['admin'] },
];

export function modulesForRole(role: Role) {
  return MODULES.filter((m) => m.roles.includes(role));
}

export function moduleHref(role: Role, modulePath: string) {
  return `/dashboard/${role}/${modulePath}`;
}
