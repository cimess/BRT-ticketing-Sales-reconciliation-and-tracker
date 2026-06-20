import { auth } from "@/auth";
import LocationsPage from "@/app/dashboard/LocationPage";

export default async function Page() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  return <LocationsPage role={session.user.role} />;
}
