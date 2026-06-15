export const Roles = {
  ADMIN: "ADMIN",
  USER: "USER",
  SUPERVISOR: "SUPERVISOR",
} as const;

export type Role = keyof typeof Roles;