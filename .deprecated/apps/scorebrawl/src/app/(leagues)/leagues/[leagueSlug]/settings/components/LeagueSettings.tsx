"use client";
import { resetLastVisitedLeague } from "@/actions/navigation-actions";
import { AvatarWithFallback } from "@/components/avatar/avatar-with-fallback";
import { DEFAULT_LEAGUE_LOGO } from "@/components/league/league-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadButton } from "@/components/uploadthing";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/trpc/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export const LeagueSettings = ({ leagueSlug }: { leagueSlug: string }) => {
  const { push } = useRouter();
  const { mutate } = api.league.update.useMutation();
  const { league: leagueUtils } = api.useUtils();
  const { data: league } = api.league.getLeagueBySlugAndRole.useQuery({ leagueSlug });
  const [nameInput, setNameInput] = useState(league?.name ?? "");
  const timerRef = useRef<null | Timer>(null);
  const { toast } = useToast();
  const [uploadError, setUploadError] = useState<string | undefined>();
  const [_uploadInProgress, setUploadInProgress] = useState(false);
  const [_logoUrl, setLogoUrl] = useState(league?.logoUrl ?? "");

  useEffect(() => {
    if (league) {
      setNameInput(league.name);
      setLogoUrl(league.logoUrl ?? DEFAULT_LEAGUE_LOGO);
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
                push(`/leagues/${data.slug}/settings`);
              }
            },
          },
        );
      }, 300);
    },
    [leagueSlug, toast, mutate, push],
  );

  return (
    <>
      <div className={"flex flex-col items-center gap-3"}>
        <AvatarWithFallback size="xl" image={league?.logoUrl} name={league?.name ?? ""} />
        <UploadButton
          className="ut-button:h-10 ut-button:items-center ut-button:justify-center ut-button:rounded-md ut-button:bg-primary ut-button:px-4 ut-button:py-2 ut-button:text-sm ut-button:font-medium ut-button:text-primary-foreground ut-button:ring-offset-background ut-button:transition-colors ut-button:hover:bg-primary/90 ut-button:focus-visible:outline-none ut-button:focus-visible:ring-2 ut-button:focus-visible:ring-ring ut-button:focus-visible:ring-offset-2 ut-button:disabled:pointer-events-none ut-button:disabled:opacity-50"
          endpoint="leagueLogo"
          onUploadBegin={() => setUploadInProgress(true)}
          onUploadProgress={() => {
            setUploadError(undefined);
          }}
          content={{
            allowedContent: ({
              isUploading,
              uploadProgress,
            }: {
              isUploading: boolean;
              uploadProgress: number;
            }) => {
              if (uploadError) {
                return <p className="text-destructive">{uploadError}</p>;
              }
              return isUploading ? (
                <p>{`Uploading ${uploadProgress}%...`}</p>
              ) : (
                <p>Square images recommended (Max 4MB)</p>
              );
            },
          }}
          onClientUploadComplete={(res: { url: string }[]) => {
            setUploadInProgress(false);
            const fileUrl = res?.[0]?.url;
            if (fileUrl) {
              setLogoUrl(fileUrl);
              mutate(
                { leagueSlug, logoUrl: fileUrl },
                {
                  onSuccess: () => {
                    leagueUtils.getLeagueBySlugAndRole.invalidate();
                  },
                },
              );
            }
          }}
          onUploadError={(error: Error) => {
            setUploadInProgress(false);
            setUploadError(error.message);
          }}
        />
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
