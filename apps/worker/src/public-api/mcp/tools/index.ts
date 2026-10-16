import type { McpTool } from "../tool";
import { buildDataTools } from "./data-tools";
import { listLeaguesTool } from "./list-leagues";
import { whoamiTool } from "./whoami";

export const tools: readonly McpTool[] = [whoamiTool, listLeaguesTool, ...buildDataTools()];
