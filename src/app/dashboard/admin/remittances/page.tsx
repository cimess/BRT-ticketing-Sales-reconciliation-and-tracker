import RemittancesPage from "@/dashboard/RemittancesPage";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function RemitanceRoute() {
    const session = await auth();
    if(!session) return redirect("/")

    return (
        <RemittancesPage role="ADMIN" />
    )
}
