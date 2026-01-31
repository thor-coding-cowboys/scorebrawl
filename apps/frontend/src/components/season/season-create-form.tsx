// @ts-nocheck - discriminated union form types are complex
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  EloSeasonCreateDTOSchema,
  ThreeOneNilSeasonCreateDTOSchema,
} from "@scorebrawl/database/dto";
import { useNavigate } from "@tanstack/react-router";
import { endOfDay, startOfDay } from "date-fns";
import { useForm } from "react-hook-form";
import { z } from "zod";

// Create extended schemas with date validation
const createEloSchema = (leagueSlug: string) =>
  EloSeasonCreateDTOSchema.omit({ leagueSlug: true })
    .extend({ leagueSlug: z.literal(leagueSlug) })
    .refine((data) => !data.endDate || endOfDay(data.endDate) > startOfDay(data.startDate), {
      message: "End date must be after start date",
      path: ["endDate"],
    });

const createThreeOneNilSchema = (leagueSlug: string) =>
  ThreeOneNilSeasonCreateDTOSchema.omit({ leagueSlug: true })
    .extend({ leagueSlug: z.literal(leagueSlug) })
    .refine((data) => !data.endDate || endOfDay(data.endDate) > startOfDay(data.startDate), {
      message: "End date must be after start date",
      path: ["endDate"],
    });

interface SeasonCreateFormProps {
  leagueSlug: string;
  scoreType: "elo" | "3-1-0";
}

type EloFormValues = z.input<typeof EloSeasonCreateDTOSchema>;
type ThreeOneNilFormValues = z.input<typeof ThreeOneNilSeasonCreateDTOSchema>;

export function SeasonCreateForm({ leagueSlug, scoreType }: SeasonCreateFormProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createSeason = trpc.season.create.useMutation();

  const isElo = scoreType === "elo";

  // @ts-ignore - discriminated union form types are complex
  const form = useForm({
    // @ts-ignore - discriminated union form types are complex
    resolver: zodResolver(
      isElo ? createEloSchema(leagueSlug) : createThreeOneNilSchema(leagueSlug),
    ),
    // @ts-ignore - discriminated union form types are complex
    defaultValues: isElo
      ? {
          leagueSlug,
          scoreType: "elo" as const,
          name: "",
          startDate: new Date(),
          initialScore: 1200,
          kFactor: 32,
        }
      : {
          leagueSlug,
          scoreType: "3-1-0" as const,
          name: "",
          startDate: new Date(),
          roundsPerPlayer: 1,
        },
  });

  const onSubmit = async (values: EloFormValues | ThreeOneNilFormValues) => {
    createSeason.mutate(values, {
      onSuccess: (data) => {
        navigate({
          to: "/leagues/$leagueSlug/seasons/$seasonSlug",
          params: { leagueSlug, seasonSlug: data.slug },
        });
      },
      onError: (error) => {
        toast({
          title: "Failed to create season",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Create {isElo ? "ELO" : "3-1-0"} Season</h2>
        <p className="text-muted-foreground">Fill out the details for your new season</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Season Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Name Field - Common to both types */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Season Name <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Spring 2024" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Start Date Field - Common to both types */}
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <DatePicker date={field.value} setDate={field.onChange} />
                    </FormControl>
                    <FormDescription>When the season begins (defaults to today)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* End Date Field - Common to both types */}
              {/* @ts-ignore - discriminated union field types */}
              <FormField
                control={form.control}
                name={"endDate"}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <DatePicker date={field.value as Date | undefined} setDate={field.onChange} />
                    </FormControl>
                    <FormDescription>When the season ends (optional)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ELO-Specific Fields */}
              {isElo && (
                <>
                  <FormField
                    control={form.control}
                    name="initialScore"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Initial Score <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="1"
                            min="50"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Starting ELO rating for all players (default: 1200, min: 50)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="kFactor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          K-Factor <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="1"
                            min="10"
                            max="50"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Higher values lead to more volatile ratings (range: 10-50, default: 32)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* 3-1-0-Specific Fields */}
              {/* @ts-ignore - discriminated union field types */}
              {!isElo && (
                <FormField
                  control={form.control}
                  name="roundsPerPlayer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Rounds per Player <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        {/* @ts-ignore - discriminated union field types */}
                        <Input
                          type="number"
                          step="1"
                          min="1"
                          max="365"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Number of rounds each player participates in (range: 1-365, default: 1)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="flex justify-between pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    navigate({
                      to: "/leagues/$leagueSlug/seasons/create",
                      params: { leagueSlug },
                    })
                  }
                >
                  Back
                </Button>
                <Button type="submit" disabled={createSeason.isPending}>
                  {createSeason.isPending ? "Creating..." : "Create Season"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
