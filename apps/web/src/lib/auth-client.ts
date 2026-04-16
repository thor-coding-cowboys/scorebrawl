import { passkeyClient } from "@better-auth/passkey/client";
import { organizationClient, adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	plugins: [organizationClient({}), passkeyClient(), adminClient()],
});
