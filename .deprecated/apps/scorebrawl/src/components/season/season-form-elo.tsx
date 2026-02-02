"use client";
import AutoForm from "@/components/auto-form";
import { LoadingButton } from "@/components/loading-button";
import { EloSeasonCreateDTOSchema } from "@/dto";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/trpc/react";
import { endOfDay, startOfDay } from "date-fns";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect } from "react";
import { z } from "zod";

type FormValues = {
  name: string;
  initialScore: number;
  startDate: Date;
  eloType?: "team vs team";
  endDate?: Date;
  kFactor: number;
};

const schema = EloSeasonCreateDTOSchema.omit({
  scoreType: true,
  leagueSlug: true,
  kFactor: true,
  initialScore: true,
})
  .merge(
    z.object({
      initialScore: z.coerce.number().int().min(50).default(1200),
      kFactor: z.coerce.number().int().min(10).max(50).default(32),
    }),
  )
  .refine((data) => data.endDate && endOfDay(data.endDate) > startOfDay(data.startDate), {
    message: "End date cannot be earlier than start date.",
    path: ["endDate"],
  });

export const SeasonFormElo = ({ league }: { league: { id: string; slug: string } }) => {
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
    setScoreType("elo");
  }, [setScoreType]);
  const onSubmit = async (val: FormValues) => {
    mutate(
      {
        ...val,
        startDate: startOfDay(val.startDate),
        endDate: val.endDate ? endOfDay(val.endDate) : undefined,
        leagueSlug: league.slug,
        scoreType: "elo",
        initialScore: val.initialScore,
      },
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
      <p className="text-xs text-muted-foreground  h-16">
        Create a season using the Elo Points System. A higher K-Factor may lead to more volatile
        ratings, while a lower K-Factor results in more stable ratings over time.
      </p>
      <AutoForm className="flex-1" formSchema={schema} onSubmit={onSubmit}>
        <LoadingButton loading={isPending} type="submit">
          Create Season
        </LoadingButton>
      </AutoForm>
    </>
  );
};
