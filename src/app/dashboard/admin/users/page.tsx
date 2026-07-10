import UsersPage, { RegToken } from "@/dashboard/UsersPage";
import { auth } from "@/auth";
import { getTokens } from "@/app/server/services/regtrationtokenGen.service";
import { Roles } from "@prisma/client";

export default async function UsersRoute({
  searchParams,
}: {
  searchParams: Promise<{
    issued_by?: string;
  }>;
}) {

  const params = await searchParams;
  const session = await auth();
  if (!session?.user?.id) {
    return <div>Unauthenticated</div>;
  }

  const result = await getTokens({
    companyId: session.user.company_id,
    issued_by: params.issued_by,
    requester_id: session.user.id,
    requester_role: session.user.role as Roles,
  });

  // 💡 Serialize Date objects to ISO strings for Next.js boundary compatibility
  const serializedTokens:RegToken[] = result.tokens.map((token) => ({
    ...token,
    created_at: token.created_at.toISOString(),
    expires_at: token.expires_at ? token.expires_at.toISOString() : null,
  }));
  

  return (
    <UsersPage
      regToken={serializedTokens}
    />
  );
}
