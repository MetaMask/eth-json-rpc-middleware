import type { JsonRpcMiddleware } from '@metamask/json-rpc-engine';
import type {
  Json,
  JsonRpcParams,
  JsonRpcRequest,
  JsonRpcResponse,
} from '@metamask/utils';

export interface JsonRpcRequestToCache<Params extends JsonRpcParams>
  extends JsonRpcRequest<Params> {
  skipCache?: boolean;
}

export type JsonRpcCacheMiddleware<
  Params extends JsonRpcParams,
  Result extends Json,
> = JsonRpcMiddleware<Params, Result> extends (
  req: JsonRpcRequest<Params>,
  ...args: infer X
) => infer Y
  ? (req: JsonRpcRequestToCache<Params>, ...args: X) => Y
  : never;

export type BlockData = string | string[];

export type Block = Record<string, BlockData>;

export type BlockCache = Record<string, Block>;

export type Cache = Record<number, BlockCache>;

/**
 * A copy of the type for the `request` method from `AbstractRpcService` in
 *`@metamask/network-controller`.
 *
 * We cannot get this directly from `@metamask/network-controller` because
 * relying on this package would create a circular dependency.
 *
 * This type should be accurate as of `@metamask/network-controller` 24.x and
 * `@metamask/utils` 11.x.
 */
export type AbstractRpcServiceRequestMethod = <
  Params extends JsonRpcParams,
  Result extends Json,
>(
  jsonRpcRequest: JsonRpcRequest<Params>,
  fetchOptions?: RequestInit,
) => Promise<JsonRpcResponse<Result | null>>;
