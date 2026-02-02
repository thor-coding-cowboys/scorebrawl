"use client";

import AutoForm from "@/components/auto-form";
import { LoadingButton } from "@/components/loading-button";
import { InviteInputDTO, type LeagueMemberRole } from "@/dto";
import { api } from "@/trpc/react";
import { endOfDay } from "date-fns";
import type { z } from "zod";

type FormValues = {
  role: z.infer<typeof LeagueMemberRole>;
  expiresAt?: Date;
};

export const InviteForm = ({
  leagueSlug,
  onSuccess,
}: { leagueSlug: string; onSuccess?: () => void }) => {
  const { invite } = api.useUtils();
  const { mutate, isPending } = api.invite.create.useMutation();
  const onSubmit = async (val: FormValues) => {
    mutate(
      { ...val, expiresAt: val.expiresAt ? endOfDay(val.expiresAt) : undefined, leagueSlug },
      {
        onSuccess: () => {
          invite.getAll.invalidate({ leagueSlug });
          onSuccess?.();
        },
      },
    );
  };

  return (
    <AutoForm formSchema={InviteInputDTO.omit({ leagueSlug: true })} onSubmit={onSubmit}>
      <LoadingButton loading={isPending} type="submit">
        Create Invite
      </LoadingButton>
    </AutoForm>
  );
};
