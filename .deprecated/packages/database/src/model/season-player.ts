import z from "zod";
import { MatchResultSymbolSchema } from "./match";

export const PlayerFormSchema = z.array(MatchResultSymbolSchema);
export type PlayerForm = z.infer<typeof PlayerFormSchema>;
