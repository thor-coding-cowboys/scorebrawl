import { QueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";

export interface CreateQueryClientOptions {
	gcTime?: number;
}

export function createQueryClient(options: CreateQueryClientOptions = {}) {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 60 * 1000,
				...(options.gcTime === undefined ? {} : { gcTime: options.gcTime }),
				refetchOnWindowFocus: false,
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
}
