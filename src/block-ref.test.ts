import { isDeepStrictEqual } from 'util';
import { PollingBlockTracker, Provider } from 'eth-block-tracker';
import {
  JsonRpcEngine,
  JsonRpcMiddleware,
  JsonRpcRequest,
  JsonRpcResponse,
} from 'json-rpc-engine';
import clone from 'clone';
import {
  SafeEventEmitterProvider,
  providerFromEngine,
  createBlockRefMiddleware,
} from '.';

/**
 * Objects used in each test.
 *
 * @property engine - The engine that holds the middleware stack, including the
 * one being tested.
 * @property provider - The provider that is used to make requests against
 * (which the middleware being tested will react to).
 * @property blockTracker - The block tracker which is used inside of the
 * middleware being tested.
 */
interface Setup {
  engine: JsonRpcEngine;
  provider: SafeEventEmitterProvider;
  blockTracker: PollingBlockTracker;
}

/**
 * The function that `withTestSetup` is expected to take and will call once the
 * setup objects are created.
 */
type WithTestSetupCallback<T> = (setup: Setup) => Promise<T>;

/**
 * An object that can be used to assign a canned response to a request (or an
 * object that can be used to match a request) made via `provider.sendAsync`.
 *
 * @property request - An object that represents a JsonRpcRequest. Keys such as
 * `id` or `jsonrpc` may be omitted if you don't care about them.
 * @property response - A function that returns a JsonRpcResponse for that
 * request. This function takes two arguments: the *real* request and a
 * `callNumber`, which is the number of times the request has been made
 * (counting the first request as 1). This latter argument be used to specify
 * different responses for different instances of the same request.
 * @property remainAfterUse - Usually, when a request is made via
 * `provider.sendAsync`, the ProviderRequestStub which matches that request is
 * removed from the list of stubs, so that if the same request comes through
 * again, there will be no matching stub and an error will be thrown. This
 * feature is useful for making sure that all requests have canned responses.
 */
interface ProviderRequestStub<T, U> {
  request: Partial<JsonRpcRequest<T>>;
  response: (
    request: JsonRpcRequest<T>,
    callNumber: number,
  ) => JsonRpcResponse<U>;
  remainAfterUse?: boolean;
}

describe('createBlockRefMiddleware', () => {
  // This list corresponds to the list in the `blockTagParamIndex` function
  // within `src/utils/cache.ts`
  (
    [
      { blockParamIndex: 0, methods: ['eth_getBlockByNumber'] },
      {
        blockParamIndex: 1,
        methods: [
          'eth_getBalance',
          'eth_getCode',
          'eth_getTransactionCount',
          'eth_call',
        ],
      },
      { blockParamIndex: 2, methods: ['eth_getStorageAt'] },
    ] as const
  ).forEach(({ blockParamIndex, methods }) => {
    methods.forEach((method: string) => {
      describe(`when the RPC method is ${method}`, () => {
        it('replaces the block param with the latest block number before proceeding to the next middleware if the block param is "latest"', async () => {
          await withTestSetup(async ({ engine, provider, blockTracker }) => {
            engine.push(createBlockRefMiddleware({ provider, blockTracker }));
            const middleware = buildFinalMiddlewareWithDefaultResponse();
            engine.push(middleware);
            stubProviderRequests(provider, [stubBlockNumberRequest('0x100')]);

            await engine.handle({
              jsonrpc: '2.0',
              id: 1,
              method,
              params: buildMockParamsWithBlockParamAt(
                blockParamIndex,
                'latest',
              ),
            });

            expect(middleware).toHaveBeenCalledWith(
              expect.objectContaining({
                params: buildMockParamsWithBlockParamAt(
                  blockParamIndex,
                  '0x100',
                ),
              }),
              expect.anything(),
              expect.anything(),
              expect.anything(),
            );
          });
        });

        it('replaces the block param with the latest block number before proceeding to the next middleware if no block param is provided', async () => {
          await withTestSetup(async ({ engine, provider, blockTracker }) => {
            engine.push(createBlockRefMiddleware({ provider, blockTracker }));
            const middleware = buildFinalMiddlewareWithDefaultResponse();
            engine.push(middleware);
            stubProviderRequests(provider, [stubBlockNumberRequest('0x100')]);

            await engine.handle({
              jsonrpc: '2.0',
              id: 1,
              method,
              params: buildMockParamsWithoutBlockParamAt(blockParamIndex),
            });

            expect(middleware).toHaveBeenCalledWith(
              expect.objectContaining({
                params: buildMockParamsWithBlockParamAt(
                  blockParamIndex,
                  '0x100',
                ),
              }),
              expect.anything(),
              expect.anything(),
              expect.anything(),
            );
          });
        });

        it.each(['earliest', 'pending', '0x200'])(
          'does not touch the request params before proceeding to the next middleware if the block param is something other than "latest", like %o',
          async (blockParam) => {
            await withTestSetup(async ({ engine, provider, blockTracker }) => {
              engine.push(createBlockRefMiddleware({ provider, blockTracker }));
              const middleware = buildFinalMiddlewareWithDefaultResponse();
              engine.push(middleware);
              stubProviderRequests(provider, [stubBlockNumberRequest('0x100')]);

              await engine.handle({
                jsonrpc: '2.0',
                id: 1,
                method,
                params: buildMockParamsWithBlockParamAt(
                  blockParamIndex,
                  blockParam,
                ),
              });

              expect(middleware).toHaveBeenCalledWith(
                expect.objectContaining({
                  params: buildMockParamsWithBlockParamAt(
                    blockParamIndex,
                    blockParam,
                  ),
                }),
                expect.anything(),
                expect.anything(),
                expect.anything(),
              );
            });
          },
        );
      });
    });
  });

  describe('when the RPC method does not take a block parameter', () => {
    it('does not touch the request params before proceeding to the next middleware', async () => {
      await withTestSetup(async ({ engine, provider, blockTracker }) => {
        engine.push(createBlockRefMiddleware({ provider, blockTracker }));
        const middleware = buildFinalMiddlewareWithDefaultResponse();
        engine.push(middleware);
        stubProviderRequests(provider, [stubBlockNumberRequest('0x100')]);

        await engine.handle({
          jsonrpc: '2.0',
          id: 1,
          method: 'a_non_block_param_method',
          params: ['some value', '0x200'],
        });

        expect(middleware).toHaveBeenCalledWith(
          expect.objectContaining({
            params: ['some value', '0x200'],
          }),
          expect.anything(),
          expect.anything(),
          expect.anything(),
        );
      });
    });
  });
});

/**
 * Calls the given function, which should represent a test of some kind, with data
 * that the test can use, namely, a JsonRpcEngine instance, a provider object,
 * and a block tracker.
 *
 * @param fn - A function.
 * @returns Whatever the function returns.
 */
async function withTestSetup<T>(fn: WithTestSetupCallback<T>) {
  const engine = new JsonRpcEngine();
  const provider = providerFromEngine(engine);
  const blockTracker = new PollingBlockTracker({
    provider: provider as Provider,
  });

  return await fn({ engine, provider, blockTracker });
}

/**
 * Creates a middleware function that ends the request, but not before ensuring
 * that the response has been filled with something.
 *
 * @returns The created middleware, as a mock function.
 */
function buildFinalMiddlewareWithDefaultResponse<T, U>(): JsonRpcMiddleware<
  T,
  U | 'default response'
> {
  return jest.fn((req, res, _next, end) => {
    if (res.id === undefined) {
      res.id = req.id;
    }

    if (res.jsonrpc === undefined) {
      res.jsonrpc = '2.0';
    }

    if (res.result === undefined) {
      res.result = 'default response';
    }

    end();
  });
}

/**
 * Some JSON-RPC endpoints take a "block" param (example: `eth_blockNumber`)
 * which can optionally be left out. Additionally, the endpoint may support some
 * number of arguments, although the "block" param will always be last, even if
 * it is optional. Given this, this function builds a `params` array for such an
 * endpoint with the given "block" param added at the end.
 *
 * @param index - The index within the `params` array to add the "block" param.
 * @param blockParam - The desired "block" param to add.
 * @returns The mock params.
 */
function buildMockParamsWithBlockParamAt(
  blockParamIndex: number,
  blockParam: string,
): string[] {
  const params = [];

  for (let i = 0; i < blockParamIndex; i++) {
    params.push('some value');
  }

  params.push(blockParam);
  return params;
}

/**
 * Some JSON-RPC endpoints take a "block" param (example: `eth_blockNumber`)
 * which can optionally be left out. Additionally, the endpoint may support some
 * number of arguments, although the "block" param will always be last, even if
 * it is optional. Given this, this function builds a mock `params` array for
 * such an endpoint, filling it with arbitrary values, but with the "block"
 * param missing.
 *
 * @param {number} index - The index within the `params` array where the "block"
 * param *would* appear.
 * @returns {string[]} The mock params.
 */
function buildMockParamsWithoutBlockParamAt(blockParamIndex: number): string[] {
  const params = [];

  for (let i = 0; i < blockParamIndex; i++) {
    params.push('some value');
  }

  return params;
}

/**
 * Builds a canned response for a `eth_blockNumber` request made to
 * `provider.sendAsync` such that the response will return the given block
 * number. Intended to be used in conjunction with `stubProviderRequests`.
 *
 * @param blockNumber - The block number (default: '0x0').
 * @returns The request/response pair.
 */
function stubBlockNumberRequest(
  blockNumber = '0x0',
): ProviderRequestStub<undefined[], string> {
  return {
    request: {
      method: 'eth_blockNumber',
      params: [],
    },
    response: (req) => ({
      id: req.id,
      jsonrpc: '2.0',
      result: blockNumber,
    }),
  };
}

/**
 * Provides a way to assign specific responses to specific requests that are
 * made through a provider. When `provider.sendAsync` is called, a stub matching
 * the request will be looked for; if one is found, it is used and then
 * discarded, unless `remainAfterUse` is set for the stub.
 *
 * @param provider - The provider.
 * @param stubs - A series of pairs, where each pair specifies a request object
 * — or part of one, at least — and a response for that request. The response
 * is actually a function that takes two arguments: the *real* request and the
 * number of times that that request has been made (counting the first as 1).
 * This latter argument be used to specify different responses for different
 * instances of the same request. The function should return a response object.
 * @returns The Jest spy object that represents `provider.sendAsync` (so that
 * you can make assertions on the method later, if you like).
 */
function stubProviderRequests(
  provider: SafeEventEmitterProvider,
  stubs: ProviderRequestStub<any, any>[],
) {
  const remainingStubs = clone(stubs);
  const callNumbersByRequest = new Map<
    Partial<JsonRpcRequest<unknown>>,
    number
  >();
  return jest.spyOn(provider, 'sendAsync').mockImplementation((request, cb) => {
    const stubIndex = remainingStubs.findIndex((stub) =>
      requestMatches(stub.request, request),
    );

    if (stubIndex === -1) {
      throw new Error(`Unrecognized request ${JSON.stringify(request)}`);
    } else {
      const stub = remainingStubs[stubIndex];
      const callNumber = callNumbersByRequest.get(stub.request) ?? 1;

      cb(undefined, stub.response(request, callNumber));

      callNumbersByRequest.set(stub.request, callNumber + 1);

      if (!stub.remainAfterUse) {
        remainingStubs.splice(stubIndex, 1);
      }
    }
  });
}

/**
 * When using `stubProviderRequests` to list canned responses for specific
 * requests that are made to `provider.sendAsync`, you don't need to provide the
 * full request object to go along with the response, but only part of that
 * request object. When `provider.sendAsync` is then called, we can look up the
 * compare the real request object to the request object that was specified to
 * find a match. This function is used to do that comparison (and other
 * like comparisons).
 *
 * @param requestMatcher - A partial request object.
 * @param request - A real request object.
 * @returns True or false depending on whether the partial request object "fits
 * inside" the real request object.
 */
function requestMatches(
  requestMatcher: Partial<JsonRpcRequest<unknown>>,
  request: JsonRpcRequest<unknown>,
): boolean {
  return (Object.keys(requestMatcher) as (keyof typeof requestMatcher)[]).every(
    (key) => isDeepStrictEqual(requestMatcher[key], request[key]),
  );
}
