import type {
  Json,
  JsonRpcRequest,
  PendingJsonRpcResponse,
} from '@metamask/utils';
import { klona } from 'klona';

import type {
  ProcessRevokeExecutionPermissionHook,
  RevokeExecutionPermissionsRequestParams,
} from './wallet-revoke-execution-permission';
import { walletRevokeExecutionPermission } from './wallet-revoke-execution-permission';

const HEX_MOCK = '0x123abc';

const REQUEST_MOCK = {
  params: {
    permissionContext: HEX_MOCK,
  },
} as unknown as JsonRpcRequest<RevokeExecutionPermissionsRequestParams>;

describe('wallet_revokeExecutionPermission', () => {
  let request: JsonRpcRequest<RevokeExecutionPermissionsRequestParams>;
  let params: RevokeExecutionPermissionsRequestParams;
  let response: PendingJsonRpcResponse<Json>;
  let processRevokeExecutionPermissionMock: jest.MockedFunction<ProcessRevokeExecutionPermissionHook>;

  async function callMethod() {
    return walletRevokeExecutionPermission(request, response, {
      processRevokeExecutionPermission: processRevokeExecutionPermissionMock,
    });
  }

  beforeEach(() => {
    jest.resetAllMocks();

    request = klona(REQUEST_MOCK);
    params = request.params as RevokeExecutionPermissionsRequestParams;
    response = {} as PendingJsonRpcResponse<Json>;

    processRevokeExecutionPermissionMock = jest.fn();
    processRevokeExecutionPermissionMock.mockResolvedValue({});
  });

  it('calls hook', async () => {
    await callMethod();
    expect(processRevokeExecutionPermissionMock).toHaveBeenCalledWith(
      params,
      request,
    );
  });

  it('returns result from hook', async () => {
    await callMethod();
    expect(response.result).toStrictEqual({});
  });

  it('throws if no hook', async () => {
    await expect(
      walletRevokeExecutionPermission(request, response, {}),
    ).rejects.toThrow(
      'wallet_revokeExecutionPermission - no middleware configured',
    );
  });

  it('throws if no params', async () => {
    (request as JsonRpcRequest).params = undefined;

    await expect(callMethod()).rejects.toThrow('Invalid params');
  });

  it('throws if missing properties', async () => {
    (request as JsonRpcRequest).params = {} as never;

    await expect(callMethod()).rejects.toThrow('Invalid params');
  });

  it('throws if wrong types', async () => {
    params.permissionContext = 123 as never;

    await expect(callMethod()).rejects.toThrow('Invalid params');
  });

  it('throws if not hex', async () => {
    params.permissionContext = '123' as never;

    await expect(callMethod()).rejects.toThrow('Invalid params');
  });
});
