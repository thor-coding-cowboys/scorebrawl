import { createContext } from "react";

export const clientPackageName = "@coding-cowboys/scorebrawl-client";

export const ScorebrawlClientContext = createContext<string | null>(null);
