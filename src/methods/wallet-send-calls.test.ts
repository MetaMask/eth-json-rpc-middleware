import type { JsonRpcRequest, PendingJsonRpcResponse } from '@metamask/utils';
import { klona } from 'klona';

import type { ProcessSendCalls, SendCallsParams } from './wallet-send-calls';
import { walletSendCalls } from './wallet-send-calls';
import type { WalletMiddlewareOptions } from '../wallet';

type GetAccounts = WalletMiddlewareOptions['getAccounts'];

const ADDRESS_MOCK = '0x123abc123abc123abc123abc123abc123abc123a';
const HEX_MOCK = '0x123abc';
const ID_MOCK = '1234-5678';

const REQUEST_MOCK = {
  params: [
    {
      from: ADDRESS_MOCK,
      chainId: HEX_MOCK,
      calls: [
        {
          to: ADDRESS_MOCK,
          data: HEX_MOCK,
          value: HEX_MOCK,
        },
      ],
    },
  ],
} as unknown as JsonRpcRequest<SendCallsParams>;

describe('wallet_sendCalls', () => {
  let request: JsonRpcRequest<SendCallsParams>;
  let params: SendCallsParams;
  let response: PendingJsonRpcResponse<string>;
  let getAccountsMock: jest.MockedFn<GetAccounts>;
  let processSendCallsMock: jest.MockedFunction<ProcessSendCalls>;

  async function callMethod() {
    return walletSendCalls(request, response, {
      getAccounts: getAccountsMock,
      processSendCalls: processSendCallsMock,
    });
  }

  beforeEach(() => {
    jest.resetAllMocks();

    request = klona(REQUEST_MOCK);
    params = request.params as SendCallsParams;
    response = {} as PendingJsonRpcResponse<string>;

    getAccountsMock = jest.fn().mockResolvedValue([ADDRESS_MOCK]);
    processSendCallsMock = jest.fn().mockResolvedValue(ID_MOCK);
  });

  it('calls hook', async () => {
    await callMethod();
    expect(processSendCallsMock).toHaveBeenCalledWith(params[0], request);
  });

  it('returns ID from hook', async () => {
    await callMethod();
    expect(response.result).toStrictEqual(ID_MOCK);
  });

  it('throws if no params', async () => {
    request.params = undefined;

    await expect(callMethod()).rejects.toMatchInlineSnapshot(`
            [Error: Invalid params

            Expected an array, but received: undefined]
          `);
  });

  it('throws if missing properties', async () => {
    params[0].from = undefined as never;
    params[0].chainId = undefined as never;
    params[0].calls = undefined as never;

    await expect(callMethod()).rejects.toMatchInlineSnapshot(`
            [Error: Invalid params

            0 > from - Expected a string, but received: undefined
            0 > calls - Expected an array value, but received: undefined]
          `);
  });

  it('throws if wrong types', async () => {
    params[0].from = '123' as never;
    params[0].chainId = 123 as never;
    params[0].calls = '123' as never;

    await expect(callMethod()).rejects.toMatchInlineSnapshot(`
            [Error: Invalid params

            0 > from - Expected a string matching \`/^0x[0-9a-fA-F]{40}$/\` but received "123"
            0 > chainId - Expected a string, but received: 123
            0 > calls - Expected an array value, but received: "123"]
          `);
  });

  it('throws if calls have wrong types', async () => {
    params[0].calls[0].data = 123 as never;
    params[0].calls[0].to = 123 as never;
    params[0].calls[0].value = 123 as never;

    await expect(callMethod()).rejects.toMatchInlineSnapshot(`
            [Error: Invalid params

            0 > calls > 0 > to - Expected a string, but received: 123
            0 > calls > 0 > data - Expected a string, but received: 123
            0 > calls > 0 > value - Expected a string, but received: 123]
          `);
  });

  it('throws if not hex', async () => {
    params[0].from = '123' as never;
    params[0].chainId = '123' as never;
    params[0].calls[0].data = '123' as never;
    params[0].calls[0].to = '123' as never;
    params[0].calls[0].value = '123' as never;

    await expect(callMethod()).rejects.toMatchInlineSnapshot(`
            [Error: Invalid params

            0 > from - Expected a string matching \`/^0x[0-9a-fA-F]{40}$/\` but received "123"
            0 > chainId - Expected a string matching \`/^0x[0-9a-f]+$/\` but received "123"
            0 > calls > 0 > to - Expected a string matching \`/^0x[0-9a-fA-F]{40}$/\` but received "123"
            0 > calls > 0 > data - Expected a string matching \`/^0x[0-9a-f]+$/\` but received "123"
            0 > calls > 0 > value - Expected a string matching \`/^0x[0-9a-f]+$/\` but received "123"]
          `);
  });

  it('throws if addresses are wrong length', async () => {
    params[0].from = '0x123' as never;
    params[0].calls[0].to = '0x123' as never;

    await expect(callMethod()).rejects.toMatchInlineSnapshot(`
            [Error: Invalid params

            0 > from - Expected a string matching \`/^0x[0-9a-fA-F]{40}$/\` but received "0x123"
            0 > calls > 0 > to - Expected a string matching \`/^0x[0-9a-fA-F]{40}$/\` but received "0x123"]
          `);
  });

  it('throws if from is not in accounts', async () => {
    getAccountsMock.mockResolvedValueOnce([]);

    await expect(callMethod()).rejects.toMatchInlineSnapshot(
      `[Error: The requested account and/or method has not been authorized by the user.]`,
    );
  });
});
