import type { AbstractRpcService as NetworkControllerAbstractRpcService } from '@metamask/network-controller';
import { expectAssignable } from 'tsd';

import type { AbstractRpcServiceRequestMethod } from './types';

// Confirm that the AbstractRpcService in this repo is compatible with the same
// one in `@metamask/network-controller` (from where it was copied)
declare const rpcServiceMethod: AbstractRpcServiceRequestMethod;
expectAssignable<NetworkControllerAbstractRpcService['request']>(
  rpcServiceMethod,
);
