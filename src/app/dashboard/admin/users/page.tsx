import UsersPage from "@/dashboard/UsersPage";
import { auth } from "@/auth";
import { getTokens } from "@/app/server/services/regtrationtokenGen.service";
import { Roles } from "@prisma/client";

export default async function UsersRoute({
  searchParams,
}: {
  searchParams: {
    issued_by?: string;
  };
}) {
  const params = await searchParams;
  const session = await auth();
  if (!session?.user?.id) {
    return <div>Unauthenticated</div>;
  }

  const result = await getTokens({
    issued_by: params.issued_by,
    requester_id: session.user.id,
    requester_role: session.user.role as Roles,
  });
  return (
    <UsersPage
      regToken={result.tokens}
    />
  );
}