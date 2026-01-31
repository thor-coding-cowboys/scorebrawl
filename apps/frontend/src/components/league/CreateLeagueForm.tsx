import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

const createLeagueSchema = z.object({
  name: z.string().min(1, "League name is required").max(100, "Name is too long"),
});

type CreateLeagueFormValues = z.infer<typeof createLeagueSchema>;

interface CreateLeagueFormProps {
  onSuccess?: (leagueSlug: string) => void;
  onCancel?: () => void;
}

export function CreateLeagueForm({ onSuccess, onCancel }: CreateLeagueFormProps) {
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string>("");
  const createLeague = trpc.league.create.useMutation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateLeagueFormValues>({
    resolver: zodResolver(createLeagueSchema),
    defaultValues: {
      name: "",
    },
  });

  const onSubmit = async (values: CreateLeagueFormValues) => {
    setApiError("");
    try {
      const league = await createLeague.mutateAsync({ name: values.name });
      if (onSuccess) {
        onSuccess(league.slug);
      } else {
        navigate({ to: "/leagues/$leagueSlug", params: { leagueSlug: league.slug } });
      }
    } catch (err) {
      setApiError(
        err instanceof Error ? err.message : "Failed to create league. Please try again.",
      );
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate({ to: "/" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Create a New League</CardTitle>
        <CardDescription>Start tracking scores and competing with your friends</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">League Name</FieldLabel>
              <Input
                id="name"
                type="text"
                placeholder="My Awesome League"
                disabled={isSubmitting}
                {...register("name")}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </Field>
            {apiError && <p className="text-sm text-destructive">{apiError}</p>}
            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? "Creating..." : "Create League"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
