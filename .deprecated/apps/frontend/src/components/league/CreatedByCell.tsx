import { AvatarName } from "@/components/avatar/avatar-name";
import { trpc } from "@/lib/trpc";

export const CreatedByCell = ({ userId }: { userId: string }) => {
  const { data } = trpc.avatar.getByUserId.useQuery({ userId });
  if (!data) {
    return null;
  }
  return <AvatarName name={data.name} image={data.image} />;
};
