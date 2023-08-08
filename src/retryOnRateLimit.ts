import type { JsonRpcError, errorCodes } from 'rpc-errors';
import { JsonRpcMiddleware, createAsyncMiddleware } from 'json-rpc-engine';
import { timeout } from './utils/timeout';

export function createRetryOnRateLimitMiddleware<T, U>(
    provider: JsonRpcMiddleware<T, U>,
): JsonRpcMiddleware<T, U> {
    return createAsyncMiddleware(async (_req, _res, next) => {
        const maxAttempts = 5;
        const retryInterval = 800;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                return next();
            } catch (err: JsonRpcError<unknown>) {
                // re-throw error if not limit exceeded
                if (!err.code == errorCodes.rpc.limitExceeded) {
                    throw err;
                }
            }
            await timeout(retryInterval);
        }
    });
}