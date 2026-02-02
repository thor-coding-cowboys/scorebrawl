"use client";
import { AvatarName } from "@/components/avatar/avatar-name";
import { api } from "@/trpc/react";

export const CreatedByCell = ({ userId }: { userId: string }) => {
  const { data } = api.avatar.getByUserId.useQuery({ userId });
  if (!data) {
    return null;
  }
  return <AvatarName name={data.name} image={data.image} />;
};
