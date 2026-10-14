import { createQueryClient } from "@coding-cowboys/scorebrawl-client/query-client";

export const queryClient = createQueryClient({ gcTime: 24 * 60 * 60 * 1000 });
