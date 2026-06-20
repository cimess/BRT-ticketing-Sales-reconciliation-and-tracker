import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await auth();

  if (!session?.user?.role) {
    redirect("/");
  }

  redirect(`/dashboard/${session.user.role.toLowerCase()}/sales`);
}
