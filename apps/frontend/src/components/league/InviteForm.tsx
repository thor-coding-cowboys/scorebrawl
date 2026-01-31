"use client";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { zodResolver } from "@hookform/resolvers/zod";
import { InviteInputDTO, type LeagueMemberRole } from "@scorebrawl/database/dto";
import { endOfDay } from "date-fns";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

type FormValues = z.infer<typeof InviteInputDTO>;

const roleLabels: Record<z.infer<typeof LeagueMemberRole>, string> = {
  viewer: "Viewer",
  member: "Member",
  editor: "Editor",
  owner: "Owner",
};

const roleDescriptions: Record<z.infer<typeof LeagueMemberRole>, string> = {
  viewer: "Can view league information",
  member: "Can participate and is registered as a player",
  editor: "Can edit league settings and is registered as a player",
  owner: "Full control over the league and is registered as a player",
};

export const InviteForm = ({
  leagueSlug,
  onSuccess,
}: {
  leagueSlug: string;
  onSuccess?: () => void;
}) => {
  const { invite } = trpc.useUtils();
  const { mutate, isPending } = trpc.invite.create.useMutation();

  const form = useForm<FormValues>({
    resolver: zodResolver(InviteInputDTO),
    defaultValues: {
      leagueSlug,
      role: "member",
      expiresAt: undefined,
    },
  });

  const onSubmit = (values: FormValues) => {
    mutate(
      {
        ...values,
        expiresAt: values.expiresAt ? endOfDay(values.expiresAt) : undefined,
      },
      {
        onSuccess: () => {
          invite.getAll.invalidate({ leagueSlug });
          form.reset();
          onSuccess?.();
        },
      },
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>{field.value && roleDescriptions[field.value]}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="expiresAt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Expires At (Optional)</FormLabel>
              <FormControl>
                <DatePicker date={field.value} setDate={field.onChange} />
              </FormControl>
              <FormDescription>
                When should this invite expire? Leave empty for no expiration.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Invite
        </Button>
      </form>
    </Form>
  );
};
