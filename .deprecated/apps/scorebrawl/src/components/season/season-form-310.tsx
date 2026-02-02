"use client";
import AutoForm from "@/components/auto-form";
import { LoadingButton } from "@/components/loading-button";
import { ThreeOneNilSeasonCreateDTOSchema } from "@/dto";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/trpc/react";
import { endOfDay, startOfDay } from "date-fns";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect } from "react";

type FormValues = {
  name: string;
  startDate: Date;
  endDate?: Date;
};

const schema = ThreeOneNilSeasonCreateDTOSchema.omit({
  leagueSlug: true,
  scoreType: true,
}).refine((data) => data.endDate && endOfDay(data.endDate) > startOfDay(data.startDate), {
  message: "End date cannot be earlier than start date.",
  path: ["endDate"],
});

export const SeasonForm310 = ({ league }: { league: { id: string; slug: string } }) => {
  const { toast } = useToast();
  const { push, refresh } = useRouter();
  const utils = api.useUtils();
  const { mutate, isPending } = api.season.create.useMutation();
  const [_scoreType, setScoreType] = useQueryState(
    "scoreType",
    parseAsString.withDefault("").withOptions({
      shallow: false,
      throttleMs: 500,
    }),
  );
  useEffect(() => {
    setScoreType("3-1-0");
  }, [setScoreType]);

  const onSubmit = async (val: FormValues) => {
    mutate(
      { ...val, scoreType: "3-1-0", leagueSlug: league.slug },
      {
        onSettled: (data) => {
          if (data) {
            push(`/leagues/${league.slug}/seasons/${data.slug}`);
          }
        },
        onSuccess: () => {
          utils.season.getAll.invalidate();
          refresh();
        },
        onError: (err) => {
          toast({
            title: "Error creating season",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <>
      <p className="text-xs text-muted-foreground h-16">
        Create a season using the Standard 3-1-0 Points System, where teams earn 3 points for a win,
        1 point for a draw, and 0 points for a loss. A straightforward scoring system for clear and
        simple match outcomes.
      </p>
      <AutoForm className="flex-1" formSchema={schema} onSubmit={onSubmit}>
        <LoadingButton loading={isPending} type="submit">
          Create Season
        </LoadingButton>
      </AutoForm>
    </>
  );
};
