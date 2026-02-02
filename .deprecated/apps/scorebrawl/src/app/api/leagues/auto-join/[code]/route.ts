import { claim, findByCode } from "@/db/repositories/invite-repository";
import { getByIdWhereMember } from "@/db/repositories/league-repository";
import { auth } from "@/lib/auth";
import { getURL } from "@/lib/auth-client";
import { headers } from "next/headers";

export const GET = async (_request: Request, { params }: { params: Promise<{ code: string }> }) => {
  const { code } = await params;
  const invite = await findByCode(code);
  if (!invite) {
    return Response.redirect("/?errorCode=INVITE_NOT_FOUND", 302);
  }

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return Response.redirect(
        `${getURL()}/auth/sign-in?redirectTo=${encodeURIComponent(`${getURL()}/api/leagues/auto-join/${code}`)}`,
        302,
      );
    }

    const league = await getByIdWhereMember({
      leagueId: invite.leagueId,
      userId: session?.user.id ?? "",
    });
    if (league) {
      return Response.redirect(
        `${getURL()}/leagues/${league.slug}?errorCode=INVITE_ALREADY_CLAIMED`,
        302,
      );
    }

    const { leagueSlug } = await claim({
      leagueId: invite.leagueId,
      role: invite.role,
      userId: session?.user.id ?? "",
    });
    console.log({ claimedLeagueSlug: leagueSlug });
    return Response.redirect(`${getURL()}/leagues/${leagueSlug}`, 302);
  } catch (err) {
    console.log(err);
    return Response.redirect(getURL());
  }
};
