import { PollingBlockTracker } from '@metamask/eth-block-tracker';
import { providerFromEngine } from '@metamask/eth-json-rpc-provider';
import type { SafeEventEmitterProvider } from '@metamask/eth-json-rpc-provider';
import type { JsonRpcMiddleware } from '@metamask/json-rpc-engine';
import { JsonRpcEngine } from '@metamask/json-rpc-engine';
import { errorCodes, providerErrors, rpcErrors } from '@metamask/rpc-errors';
import type { Json, JsonRpcParams, JsonRpcRequest } from '@metamask/utils';

import { createRetryOnEmptyMiddleware } from '.';
import type { ProviderRequestStub } from '../test/util/helpers';
import {
  buildFinalMiddlewareWithDefaultResult,
  buildMockParamsWithBlockParamAt,
  buildMockParamsWithoutBlockParamAt,
  buildSimpleFinalMiddleware,
  buildStubForBlockNumberRequest,
  expectProviderRequestNotToHaveBeenMade,
  requestMatches,
  stubProviderRequests,
} from '../test/util/helpers';

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
 * Options supported by `withTestSetup`.
 *
 * @property configureMiddleware - A function which determines which middleware
 * should be added to the engine.
 */
interface WithTestSetupOptions {
  configureMiddleware: (setup: Setup) => {
    middlewareUnderTest: JsonRpcMiddleware<any, any>;
    otherMiddleware?: JsonRpcMiddleware<any, any>[];
  };
}

/**
 * The function that `withTestSetup` is expected to take and will call once the
 * setup objects are created.
 *
 * @template T - The type that the function will return, minus the promise
 * wrapper.
 */
type WithTestSetupCallback<T> = (setup: Setup) => Promise<T>;

const originalSetTimeout = setTimeout;

describe('createRetryOnEmptyMiddleware', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('throws if not given a provider', async () => {
    const promise = withTestSetup({
      configureMiddleware: () => {
        return {
          middlewareUnderTest: createRetryOnEmptyMiddleware(),
        };
      },
    });

    await expect(promise).rejects.toThrow(
      new Error(
        'RetryOnEmptyMiddleware - mandatory "provider" option is missing.',
      ),
    );
  });

  it('throws if not given a block tracker', async () => {
    const promise = withTestSetup({
      configureMiddleware: ({ provider }) => {
        return {
          middlewareUnderTest: createRetryOnEmptyMiddleware({ provider }),
        };
      },
    });

    await expect(promise).rejects.toThrow(
      new Error(
        'RetryOnEmptyMiddleware - mandatory "blockTracker" option is missing.',
      ),
    );
  });

  // This list corresponds to the list in the `blockTagParamIndex` function
  // within `cache.ts`
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
      describe(`${method}`, () => {
        it('makes a direct request through the provider, retrying it request up to 10 times and returning the response if it does not have a result of undefined', async () => {
          await withTestSetup(
            {
              configureMiddleware: ({ provider, blockTracker }) => {
                return {
                  middlewareUnderTest: createRetryOnEmptyMiddleware({
                    provider,
                    blockTracker,
                  }),
                };
              },
            },
            async ({ engine, provider }) => {
              const blockNumber = '0x0';
              const request: JsonRpcRequest<string[]> = {
                id: 1,
                jsonrpc: '2.0',
                method,
                params: buildMockParamsWithBlockParamAt(
                  blockParamIndex,
                  blockNumber,
                ),
              };
              const requestSpy = stubProviderRequests(provider, [
                buildStubForBlockNumberRequest(blockNumber),
                stubRequestThatFailsThenFinallySucceeds({
                  request,
                  numberOfTimesToFail: 9,
                  successfulResult: async () => 'something',
                }),
              ]);

              const promiseForResponse = engine.handle(request);
              await waitForRequestToBeRetried({
                requestSpy,
                request,
                numberOfTimes: 10,
              });

              expect(await promiseForResponse).toStrictEqual({
                id: 1,
                jsonrpc: '2.0',
                result: 'something',
              });
            },
          );
        });

        it('returns an error if the request is still unsuccessful after 10 retries', async () => {
          await withTestSetup(
            {
              configureMiddleware: ({ provider, blockTracker }) => {
                return {
                  middlewareUnderTest: createRetryOnEmptyMiddleware({
                    provider,
                    blockTracker,
                  }),
                };
              },
            },
            async ({ engine, provider }) => {
              const blockNumber = '0x0';
              const request: JsonRpcRequest<string[]> = {
                id: 1,
                jsonrpc: '2.0',
                method,
                params: buildMockParamsWithBlockParamAt(
                  blockParamIndex,
                  blockNumber,
                ),
              };
              const requestSpy = stubProviderRequests(provider, [
                buildStubForBlockNumberRequest(blockNumber),
                stubGenericRequest({
                  request,
                  result: () => {
                    throw providerErrors.custom({ code: -1, message: 'oops' });
                  },
                  remainAfterUse: true,
                }),
              ]);

              const promiseForResponse = engine.handle(request);
              await waitForRequestToBeRetried({
                requestSpy,
                request,
                numberOfTimes: 10,
              });

              expect(await promiseForResponse).toMatchObject({
                error: expect.objectContaining({
                  data: expect.objectContaining({
                    cause: expect.objectContaining({
                      message: 'RetryOnEmptyMiddleware - retries exhausted',
                    }),
                  }),
                }),
              });
            },
          );
        });

        it('does not proceed to the next middleware after making a request through the provider', async () => {
          const finalMiddleware = buildSimpleFinalMiddleware();

          await withTestSetup(
            {
              configureMiddleware: ({ provider, blockTracker }) => {
                return {
                  middlewareUnderTest: createRetryOnEmptyMiddleware({
                    provider,
                    blockTracker,
                  }),
                  otherMiddleware: [finalMiddleware],
                };
              },
            },
            async ({ engine, provider }) => {
              const blockNumber = '0x0';
              const request: JsonRpcRequest<string[]> = {
                id: 1,
                jsonrpc: '2.0',
                method,
                params: buildMockParamsWithBlockParamAt(
                  blockParamIndex,
                  blockNumber,
                ),
              };
              stubProviderRequests(provider, [
                buildStubForBlockNumberRequest(blockNumber),
                stubGenericRequest({
                  request,
                  result: async () => 'success',
                }),
              ]);

              await engine.handle(request);

              expect(finalMiddleware).not.toHaveBeenCalled();
            },
          );
        });

        describe('if the block number in the request params is higher than the latest block number reported by the block tracker', () => {
          it('does not make a direct request through the provider', async () => {
            await withTestSetup(
              {
                configureMiddleware: ({ provider, blockTracker }) => {
                  return {
                    middlewareUnderTest: createRetryOnEmptyMiddleware({
                      provider,
                      blockTracker,
                    }),
                  };
                },
              },
              async ({ engine, provider }) => {
                const request: JsonRpcRequest<string[]> = {
                  id: 1,
                  jsonrpc: '2.0',
                  method,
                  params: buildMockParamsWithBlockParamAt(
                    blockParamIndex,
                    '0x100',
                  ),
                };
                const requestSpy = stubProviderRequests(provider, [
                  buildStubForBlockNumberRequest('0x0'),
                ]);

                await engine.handle(request);

                expectProviderRequestNotToHaveBeenMade(requestSpy, request);
              },
            );
          });

          it('proceeds to the next middleware', async () => {
            const finalMiddleware = buildSimpleFinalMiddleware();

            await withTestSetup(
              {
                configureMiddleware: ({ provider, blockTracker }) => {
                  return {
                    middlewareUnderTest: createRetryOnEmptyMiddleware({
                      provider,
                      blockTracker,
                    }),
                    otherMiddleware: [finalMiddleware],
                  };
                },
              },
              async ({ engine, provider }) => {
                const request: JsonRpcRequest<string[]> = {
                  id: 1,
                  jsonrpc: '2.0',
                  method,
                  params: buildMockParamsWithBlockParamAt(
                    blockParamIndex,
                    '0x100',
                  ),
                };
                stubProviderRequests(provider, [
                  buildStubForBlockNumberRequest('0x0'),
                ]);

                await engine.handle(request);

                expect(finalMiddleware).toHaveBeenCalled();
              },
            );
          });
        });

        describe.each(['1', 'earliest', 'asdlsdfls'])(
          'if the block parameter is not a 0x-prefixed hex number such as %o',
          (blockParam) => {
            it('does not make a direct request through the provider', async () => {
              await withTestSetup(
                {
                  configureMiddleware: ({ provider, blockTracker }) => {
                    return {
                      middlewareUnderTest: createRetryOnEmptyMiddleware({
                        provider,
                        blockTracker,
                      }),
                    };
                  },
                },
                async ({ engine, provider }) => {
                  const request: JsonRpcRequest<string[]> = {
                    id: 1,
                    jsonrpc: '2.0',
                    method,
                    params: buildMockParamsWithBlockParamAt(
                      blockParamIndex,
                      blockParam,
                    ),
                  };
                  const requestSpy = stubProviderRequests(provider, [
                    buildStubForBlockNumberRequest('0x0'),
                  ]);

                  await engine.handle(request);

                  expectProviderRequestNotToHaveBeenMade(requestSpy, request);
                },
              );
            });

            it('proceeds to the next middleware', async () => {
              const finalMiddleware = buildSimpleFinalMiddleware();

              await withTestSetup(
                {
                  configureMiddleware: ({ provider, blockTracker }) => {
                    return {
                      middlewareUnderTest: createRetryOnEmptyMiddleware({
                        provider,
                        blockTracker,
                      }),
                      otherMiddleware: [finalMiddleware],
                    };
                  },
                },
                async ({ engine, provider }) => {
                  const request: JsonRpcRequest<string[]> = {
                    id: 1,
                    jsonrpc: '2.0',
                    method,
                    params: buildMockParamsWithBlockParamAt(
                      blockParamIndex,
                      blockParam,
                    ),
                  };
                  stubProviderRequests(provider, [
                    buildStubForBlockNumberRequest('0x0'),
                  ]);

                  await engine.handle(request);

                  expect(finalMiddleware).toHaveBeenCalled();
                },
              );
            });
          },
        );

        describe.each(['latest', 'pending'])(
          'if the block parameter is %o',
          (blockParam) => {
            it('does not make a direct request through the provider', async () => {
              await withTestSetup(
                {
                  configureMiddleware: ({ provider, blockTracker }) => {
                    return {
                      middlewareUnderTest: createRetryOnEmptyMiddleware({
                        provider,
                        blockTracker,
                      }),
                    };
                  },
                },
                async ({ engine, provider }) => {
                  const request: JsonRpcRequest<string[]> = {
                    id: 1,
                    jsonrpc: '2.0',
                    method,
                    params: buildMockParamsWithBlockParamAt(
                      blockParamIndex,
                      blockParam,
                    ),
                  };
                  const requestSpy = stubProviderRequests(provider, [
                    buildStubForBlockNumberRequest(),
                  ]);

                  await engine.handle(request);

                  expectProviderRequestNotToHaveBeenMade(requestSpy, request);
                },
              );
            });

            it('proceeds to the next middleware', async () => {
              const finalMiddleware = buildSimpleFinalMiddleware();

              await withTestSetup(
                {
                  configureMiddleware: ({ provider, blockTracker }) => {
                    return {
                      middlewareUnderTest: createRetryOnEmptyMiddleware({
                        provider,
                        blockTracker,
                      }),
                      otherMiddleware: [finalMiddleware],
                    };
                  },
                },
                async ({ engine, provider }) => {
                  const request: JsonRpcRequest<string[]> = {
                    id: 1,
                    jsonrpc: '2.0',
                    method,
                    params: buildMockParamsWithBlockParamAt(
                      blockParamIndex,
                      blockParam,
                    ),
                  };
                  stubProviderRequests(provider, [
                    buildStubForBlockNumberRequest(),
                  ]);

                  await engine.handle(request);

                  expect(finalMiddleware).toHaveBeenCalled();
                },
              );
            });
          },
        );

        describe('if no block parameter is given', () => {
          it('does not make a direct request through the provider', async () => {
            await withTestSetup(
              {
                configureMiddleware: ({ provider, blockTracker }) => {
                  return {
                    middlewareUnderTest: createRetryOnEmptyMiddleware({
                      provider,
                      blockTracker,
                    }),
                  };
                },
              },
              async ({ engine, provider }) => {
                const request: JsonRpcRequest<string[]> = {
                  id: 1,
                  jsonrpc: '2.0',
                  method,
                  params: buildMockParamsWithoutBlockParamAt(blockParamIndex),
                };
                const requestSpy = stubProviderRequests(provider, [
                  buildStubForBlockNumberRequest(),
                ]);

                await engine.handle(request);

                expectProviderRequestNotToHaveBeenMade(requestSpy, request);
              },
            );
          });

          it('proceeds to the next middleware', async () => {
            const finalMiddleware = buildSimpleFinalMiddleware();

            await withTestSetup(
              {
                configureMiddleware: ({ provider, blockTracker }) => {
                  return {
                    middlewareUnderTest: createRetryOnEmptyMiddleware({
                      provider,
                      blockTracker,
                    }),
                    otherMiddleware: [finalMiddleware],
                  };
                },
              },
              async ({ engine, provider }) => {
                const request: JsonRpcRequest<string[]> = {
                  id: 1,
                  jsonrpc: '2.0',
                  method,
                  params: buildMockParamsWithoutBlockParamAt(blockParamIndex),
                };
                stubProviderRequests(provider, [
                  buildStubForBlockNumberRequest(),
                ]);

                await engine.handle(request);

                expect(finalMiddleware).toHaveBeenCalled();
              },
            );
          });
        });
      });
    });
  });

  describe('a method that does not take a block parameter', () => {
    it('does not make a direct request through the provider', async () => {
      await withTestSetup(
        {
          configureMiddleware: ({ provider, blockTracker }) => {
            return {
              middlewareUnderTest: createRetryOnEmptyMiddleware({
                provider,
                blockTracker,
              }),
            };
          },
        },
        async ({ engine, provider }) => {
          const method = 'a_non_block_param_method';
          const request: JsonRpcRequest<string[]> = {
            id: 1,
            jsonrpc: '2.0',
            method,
          };
          const requestSpy = stubProviderRequests(provider, [
            buildStubForBlockNumberRequest(),
          ]);

          await engine.handle(request);

          expectProviderRequestNotToHaveBeenMade(requestSpy, request);
        },
      );
    });

    it('proceeds to the next middleware', async () => {
      const finalMiddleware = buildSimpleFinalMiddleware();

      await withTestSetup(
        {
          configureMiddleware: ({ provider, blockTracker }) => {
            return {
              middlewareUnderTest: createRetryOnEmptyMiddleware({
                provider,
                blockTracker,
              }),
              otherMiddleware: [finalMiddleware],
            };
          },
        },
        async ({ engine }) => {
          const method = 'a_non_block_param_method';
          const request: JsonRpcRequest<string[]> = {
            id: 1,
            jsonrpc: '2.0',
            method,
          };

          await engine.handle(request);

          expect(finalMiddleware).toHaveBeenCalled();
        },
      );
    });
  });

  describe('when provider return execution revert error', () => {
    it('returns the same error to caller', async () => {
      await withTestSetup(
        {
          configureMiddleware: ({ provider, blockTracker }) => {
            return {
              middlewareUnderTest: createRetryOnEmptyMiddleware({
                provider,
                blockTracker,
              }),
            };
          },
        },
        async ({ engine, provider }) => {
          const request: JsonRpcRequest<string[]> = {
            id: 123,
            jsonrpc: '2.0',
            method: 'eth_call',
            params: buildMockParamsWithBlockParamAt(1, '100'),
          };
          stubProviderRequests(provider, [
            buildStubForBlockNumberRequest(),
            {
              request,
              result: () => {
                throw rpcErrors.invalidInput('execution reverted');
              },
            },
          ]);
          const promiseForResponse = engine.handle(request);
          expect(await promiseForResponse).toMatchObject({
            error: expect.objectContaining({
              code: errorCodes.rpc.invalidInput,
              message: 'execution reverted',
            }),
          });
        },
      );
    });
  });
});

/**
 * Calls the given function, which should represent a test of some kind, with
 * data that the test can use, namely, a JsonRpcEngine instance, a provider
 * object, and a block tracker.
 *
 * @template T - The type that the function will return, minus the promise
 * wrapper.
 * @param options - Options.
 * @param options.configureMiddleware - A function that is called to add the
 * middleware-under-test, along with any other necessary middleware, to the
 * engine.
 * @param callback - A function.
 * @returns Whatever the function returns.
 */
async function withTestSetup<T>(
  { configureMiddleware }: WithTestSetupOptions,
  callback?: WithTestSetupCallback<T>,
) {
  const engine = new JsonRpcEngine();
  const provider = providerFromEngine(engine);
  const blockTracker = new PollingBlockTracker({
    provider,
  });

  const {
    middlewareUnderTest,
    otherMiddleware = [buildFinalMiddlewareWithDefaultResult()],
  } = configureMiddleware({ engine, provider, blockTracker });

  for (const middleware of [middlewareUnderTest, ...otherMiddleware]) {
    engine.push(middleware);
  }

  if (callback === undefined) {
    return undefined;
  }
  return await callback({ engine, provider, blockTracker });
}

/**
 * Builds a canned result for a request made to `provider.request`. Intended
 * to be used in conjunction with `stubProviderRequests`. Although not strictly
 * necessary, it helps to assign a proper type to a request/result pair.
 *
 * @param requestStub - The request/response pair.
 * @returns The request/response pair, properly typed.
 */
function stubGenericRequest<T extends JsonRpcParams, U extends Json>(
  requestStub: ProviderRequestStub<T, U>,
) {
  return requestStub;
}

/**
 * Builds a canned result for a request made to `provider.request` which
 * will error for the first N instances and then succeed on the last instance.
 * Intended to be used in conjunction with `stubProviderRequests`.
 *
 * @param request - The request matcher for the stub.
 * @param numberOfTimesToFail - The number of times the request is expected to
 * be called until it returns a successful result.
 * @param successfulResult - The result that `provider.request` will
 * return when called past `numberOfTimesToFail`.
 * @returns The request/result pair, properly typed.
 */
function stubRequestThatFailsThenFinallySucceeds<
  T extends JsonRpcParams,
  U extends Json,
>({
  request,
  numberOfTimesToFail,
  successfulResult,
}: {
  request: ProviderRequestStub<T, U>['request'];
  numberOfTimesToFail: number;
  successfulResult: ProviderRequestStub<T, U>['result'];
}): ProviderRequestStub<T, U> {
  return stubGenericRequest({
    request,
    result: async (callNumber) => {
      if (callNumber <= numberOfTimesToFail) {
        throw providerErrors.custom({ code: -1, message: 'oops' });
      }

      return await successfulResult(callNumber);
    },
    remainAfterUse: true,
  });
}

/**
 * The `retryOnEmpty` middleware, as its name implies, uses the provider to make
 * the given request, retrying said request up to 10 times if the result is
 * empty before failing. Upon retrying, it will wait a brief time using
 * `setTimeout`. Because we are using Jest's fake timers, we have to manually
 * trigger the callback passed to `setTimeout` atfter it is called. The problem
 * is that we don't know when `setTimeout` will be called while the
 * `retryOnEmpty` middleware is running, so we have to wait. We do this by
 * recording how many times `provider.request` has been called with the
 * request, and when that number goes up, we assume that `setTimeout` has been
 * called too and advance through time. We stop the loop when
 * `provider.request` has been called the given number of times.
 *
 * @param args - The arguments.
 * @param requestSpy - The Jest spy object that represents
 * `provider.request`.
 * @param request - The request object.
 * @param numberOfTimes - The number of times that we expect
 * `provider.request` to be called with `request`.
 */
async function waitForRequestToBeRetried({
  requestSpy,
  request,
  numberOfTimes,
}: {
  requestSpy: jest.SpyInstance;
  request: JsonRpcRequest;
  numberOfTimes: number;
}) {
  let iterationNumber = 1;

  while (iterationNumber <= numberOfTimes) {
    await new Promise((resolve) => originalSetTimeout(resolve, 0));

    if (
      requestSpy.mock.calls.filter((args) => requestMatches(args[0], request))
        .length === iterationNumber
    ) {
      jest.runAllTimers();
      iterationNumber += 1;
    }
  }
}
