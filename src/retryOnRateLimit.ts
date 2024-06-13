import { EthereumRpcError, errorCodes } from 'eth-rpc-errors';
import type { JsonRpcMiddleware } from 'json-rpc-engine';
import { createAsyncMiddleware } from 'json-rpc-engine';
import { timeout } from './utils/timeout';

export function createRetryOnRateLimitMiddleware(): JsonRpcMiddleware<unknown, unknown> {
    return createAsyncMiddleware(async (_req, _res, next) => {
        const maxAttempts = 5;
        const retryInterval = 800;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                return next();
            } catch (err) {
                if (!(err instanceof EthereumRpcError &&
                    err.code == errorCodes.rpc.limitExceeded)) {
                    // re-throw error if not limit exceeded
                    throw err;
                }
                await timeout(retryInterval);
            }
        }
    });
}