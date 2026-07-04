'use client'

import NotificationsPage from "../../NotificationPage";
import { useSession } from "next-auth/react";


export default function Page() {
    const session = useSession();
    if (!session.data?.user) return null;
    return <NotificationsPage role={session.data.user.role} />;
}
