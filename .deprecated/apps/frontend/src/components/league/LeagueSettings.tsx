import { resetLastVisitedLeague } from "@/actions/navigation-actions";
import { AvatarWithFallback } from "@/components/avatar/avatar-with-fallback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

export const LeagueSettings = ({ leagueSlug }: { leagueSlug: string }) => {
  const navigate = useNavigate();
  const { mutate } = trpc.league.update.useMutation();
  const { data: league } = trpc.league.getLeagueBySlugAndRole.useQuery({ leagueSlug });
  const [nameInput, setNameInput] = useState(league?.name ?? "");
  const timerRef = useRef<null | ReturnType<typeof setTimeout>>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (league) {
      setNameInput(league.name);
    }
  }, [league]);

  const debouncedUpdate = useCallback(
    ({ name }: { name: string }) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(async () => {
        mutate(
          { leagueSlug, name },
          {
            onSuccess: () => {
              toast({ title: "League updated" });
            },
            onSettled: (data) => {
              if (data) {
                resetLastVisitedLeague({ leagueSlug: data.slug });
                navigate({
                  to: "/leagues/$leagueSlug/settings",
                  params: { leagueSlug: data.slug },
                });
              }
            },
          },
        );
      }, 300);
    },
    [leagueSlug, toast, mutate, navigate],
  );

  return (
    <>
      <div className={"flex flex-col items-center gap-3"}>
        <AvatarWithFallback size="xl" image={league?.logoUrl} name={league?.name ?? ""} />
        <div className="w-full max-w-sm  md:max-w-2xl xl:max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0">
            <div className="flex-1">
              <Label htmlFor="name">League name</Label>
              <Input
                type="text"
                id="name"
                value={nameInput}
                onChange={(e) => {
                  const updatedFirstName = e.target.value;
                  setNameInput(updatedFirstName);
                  debouncedUpdate({ name: updatedFirstName });
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
