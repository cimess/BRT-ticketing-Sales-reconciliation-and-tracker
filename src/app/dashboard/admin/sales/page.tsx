import { auth } from "@/auth";
import SalesPage from "@/app/dashboard/SalesPage";

export default async function Page() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  return <SalesPage role={session.user.role} />;
}
