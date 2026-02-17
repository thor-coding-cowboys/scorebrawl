import { QueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: (failureCount, error) => {
				if (error instanceof TRPCClientError) {
					const httpStatus = error.data?.httpStatus;
					if (httpStatus && httpStatus >= 500 && httpStatus < 600) {
						return failureCount < 2;
					}
					return false;
				}
				return failureCount < 2;
			},
			retryDelay: (attemptIndex) => Math.min(2000 * 2 ** attemptIndex, 60000),
		},
		mutations: {
			retry: false,
		},
	},
});
