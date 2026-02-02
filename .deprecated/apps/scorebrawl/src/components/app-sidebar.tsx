"use client";

import { NavMain } from "@/components/nav-main";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { env } from "@/env";
import { authClient } from "@/lib/auth-client";
import { api } from "@/trpc/react";
import {
  ChartNoAxesGantt,
  Home,
  Inbox,
  type LucideIcon,
  Settings,
  User2,
  UserCog,
  Users,
} from "lucide-react";
import Image from "next/image";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LeagueSwitcher } from "./layout/league-switcher";
import { NavUser } from "./nav-user";

const constructLinks = ({
  leagueSlug,
  hasEditorAccess,
  activeSeasonSlug,
}: { leagueSlug: string; hasEditorAccess?: boolean; activeSeasonSlug: string }) => [
  {
    title: "Active Season",
    url: activeSeasonSlug
      ? `/leagues/${leagueSlug}/seasons/${activeSeasonSlug}`
      : `/leagues/${leagueSlug}/seasons/create?message=no-active`,
    regex: new RegExp(`/leagues/${leagueSlug}/seasons/${activeSeasonSlug}(\\/.*)?`),
    icon: Home,
  },
  {
    title: "Seasons",
    url: `/leagues/${leagueSlug}/seasons`,
    regex: new RegExp(
      `^/leagues/${leagueSlug}/seasons(?!/${activeSeasonSlug}(\\/|$))(?:/(?!${activeSeasonSlug})[^\\s/]+.*)?$`,
    ),
    icon: ChartNoAxesGantt,
    items: [],
  },
  {
    title: "Players",
    url: `/leagues/${leagueSlug}/players`,
    regex: new RegExp(`^/leagues/${leagueSlug}/players`),
    icon: User2,
  },
  {
    title: "Teams",
    url: `/leagues/${leagueSlug}/teams`,
    regex: new RegExp(`^/leagues/${leagueSlug}/teams`),
    icon: Users,
  },
  // add editor access links
  ...(hasEditorAccess
    ? [
        {
          title: "Members",
          url: `/leagues/${leagueSlug}/members`,
          regex: new RegExp(`^/leagues/${leagueSlug}/members`),
          icon: UserCog,
        },
        {
          title: "Invites",
          url: `/leagues/${leagueSlug}/invites`,
          regex: new RegExp(`^/leagues/${leagueSlug}/invites`),
          icon: Inbox,
        },
        {
          title: "Settings",
          url: `/leagues/${leagueSlug}/settings`,
          regex: new RegExp(`^/leagues/${leagueSlug}/settings`),
          icon: Settings,
        },
      ]
    : []),
];

export function AppSidebar({
  leagues,
  ...props
}: {
  leagues: { id: string; slug: string; name: string; logoUrl: string | null }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ leagueSlug: string }>();
  const [leagueSlug, setLeagueSlug] = useState(params.leagueSlug);
  useEffect(() => {
    if (params.leagueSlug) {
      setLeagueSlug(params.leagueSlug);
    }
  }, [params.leagueSlug]);
  const [links, setLinks] = useState<
    { title: string; url: string; regex: RegExp; icon: LucideIcon }[]
  >([]);
  const selectedLeague = leagues?.find((league) => league.slug === leagueSlug) ?? leagues?.[0];
  const { data: hasEditorAccess } = api.league.hasEditorAccess.useQuery(
    { leagueSlug: selectedLeague?.slug as string },
    { enabled: !!selectedLeague?.slug },
  );
  const { data: activeSeason } = api.season.findActive.useQuery({ leagueSlug: leagueSlug });
  useEffect(() => {
    setLinks(
      constructLinks({
        leagueSlug: leagueSlug ?? selectedLeague?.slug,
        hasEditorAccess,
        activeSeasonSlug: activeSeason?.slug ?? "",
      }),
    );
  }, [activeSeason, hasEditorAccess, leagueSlug, selectedLeague?.slug]);
  useEffect(() => {
    if (params.leagueSlug) {
      setLeagueSlug(params.leagueSlug);
    }
  }, [params.leagueSlug]);
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <LeagueSwitcher
          leagues={leagues ?? []}
          onLeagueSelect={(value) => {
            router.refresh();
            router.push(`/leagues/${value}`);
          }}
        />
      </SidebarHeader>
      <SidebarContent className="overflow-x-hidden">
        <NavMain
          items={links.map((link) => ({
            ...link,
            isActive: link.regex.test(pathname),
          }))}
        />
      </SidebarContent>
      <SidebarFooter>
        <button
          className="flex cursor-pointer items-center justify-center rounded-md p-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full"
          onClick={async () => {
            console.log(env);
            if (env.NEXT_PUBLIC_BUY_ME_A_COFFEE_PRODUCT_ID) {
              await authClient.checkout({
                products: [env.NEXT_PUBLIC_BUY_ME_A_COFFEE_PRODUCT_ID],
              });
            }
          }}
          type="button"
        >
          <Image
            src="/buy-me-coffee.png"
            alt="Buy me a coffee"
            width={200}
            height={50}
            className="rounded w-full h-auto"
          />
        </button>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
