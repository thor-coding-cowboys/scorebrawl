import { NavMain } from "@/components/nav-main";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
// import { authClient } from "@/lib/auth-client"; // Unused for now
import { trpc } from "@/lib/trpc";
import { useLocation, useNavigate, useParams } from "@tanstack/react-router";
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
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams({ strict: false });
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
  const { data: hasEditorAccess } = trpc.league.hasEditorAccess.useQuery(
    { leagueSlug: selectedLeague?.slug as string },
    { enabled: !!selectedLeague?.slug },
  );
  const { data: activeSeason } = trpc.season.findActive.useQuery(
    { leagueSlug: leagueSlug ?? "" },
    { enabled: !!leagueSlug },
  );
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
            navigate({ to: `/leagues/${value}` });
          }}
        />
      </SidebarHeader>
      <SidebarContent className="overflow-x-hidden">
        <NavMain
          items={links.map((link) => ({
            ...link,
            isActive: link.regex.test(location.pathname),
          }))}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
