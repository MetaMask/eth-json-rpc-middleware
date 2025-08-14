import { rpcErrors } from '@metamask/rpc-errors';
import type { Infer } from '@metamask/superstruct';
import {
  type Json,
  type JsonRpcRequest,
  object,
  type PendingJsonRpcResponse,
  StrictHexStruct,
} from '@metamask/utils';

import { validateParams } from '../utils/validation';

export const RevokeExecutionPermissionsResultStruct = object({});

export type RevokeExecutionPermissionsResult = Infer<
  typeof RevokeExecutionPermissionsResultStruct
>;

export const RevokeExecutionPermissionsRequestParamsStruct = object({
  permissionContext: StrictHexStruct,
});

export type RevokeExecutionPermissionsRequestParams = Infer<
  typeof RevokeExecutionPermissionsRequestParamsStruct
>;

export type ProcessRevokeExecutionPermissionHook = (
  request: RevokeExecutionPermissionsRequestParams,
  req: JsonRpcRequest,
) => Promise<RevokeExecutionPermissionsResult>;

export async function walletRevokeExecutionPermission(
  req: JsonRpcRequest,
  res: PendingJsonRpcResponse<Json>,
  {
    processRevokeExecutionPermission,
  }: {
    processRevokeExecutionPermission?: ProcessRevokeExecutionPermissionHook;
  },
): Promise<void> {
  if (!processRevokeExecutionPermission) {
    throw rpcErrors.resourceNotFound();
  }

  const { params } = req;

  validateParams(params, RevokeExecutionPermissionsRequestParamsStruct);

  res.result = await processRevokeExecutionPermission(params, req);
}
