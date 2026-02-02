"use client";

import { LoadingButton } from "@/components/loading-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactNode, useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";

const formSchema = z.object({
  name: z.string().min(1, { message: "You must enter a name." }),
});

export const UpdateTeamDialog = ({
  leagueSlug,
  team,
  children,
}: {
  leagueSlug: string;
  team: { id: string; name: string };
  children: ReactNode;
}) => {
  const { mutate, isPending } = api.leagueTeam.update.useMutation();
  const { leagueTeam } = api.useUtils();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: team.name,
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    mutate(
      { leagueSlug, teamId: team.id, name: values.name },
      {
        onSuccess: () => {
          leagueTeam.getAll.invalidate({ leagueSlug });
          leagueTeam.getBySeasonPlayerIds.invalidate({ leagueSlug });
          setOpen(false);
          toast({
            title: "Team updated",
            description: (
              <span>
                Team <strong>{team.name}</strong> name changed to <strong>{values.name}</strong>
              </span>
            ),
          });
          setOpen(false);
        },
        onError: (err) => {
          toast({
            title: "Error updating team",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <Form {...form}>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              void form.handleSubmit(onSubmit)(e);
            }}
            className="space-y-8"
            noValidate
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" placeholder="team name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <LoadingButton loading={isPending} type="submit">
                Save
              </LoadingButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Form>
  );
};
