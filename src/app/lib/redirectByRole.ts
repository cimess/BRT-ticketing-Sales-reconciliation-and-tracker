export function redirectByRole(role?: string) {
  switch (role) {
    case "ADMIN":
      return "/dashboard/admin";

    case "SUPERVISOR":
      return "/dashboard/supervisor";

    case "TICKETER":
    default:
      return "/dashboard/ticketer";
  }
}