import { LayoutActionButton } from "@/components/layout/layout-action-button";
import { InviteForm } from "@/components/league/InviteForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus } from "lucide-react";
import { useState } from "react";

export const InviteDialog = ({ leagueSlug }: { leagueSlug: string }) => {
  const [open, setOpen] = useState(false);

  const onSuccess = () => {
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <LayoutActionButton text={"Invite"} onClick={() => setOpen(true)} Icon={UserPlus} />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Create Invite</DialogTitle>
          <DialogDescription>
            Create an invite for someone to join this league. Anyone with the link can join.
            Members, editors and owners are registered as players.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <InviteForm leagueSlug={leagueSlug} onSuccess={onSuccess} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
