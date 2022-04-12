import { JsonRpcEngine } from 'json-rpc-engine';
import pify from 'pify';
import { providerFromEngine, createInflightCacheMiddleware } from '../src';

function createTestSetup() {
  // raw data source
  // create block tracker
  // create higher level
  const engine = new JsonRpcEngine();
  const provider = providerFromEngine(engine);
  return { engine, provider };
}

describe('inflight cache', () => {
  it('basic', async () => {
    const { engine } = createTestSetup();
    let hitCount = 0;

    // add inflight cache
    engine.push(createInflightCacheMiddleware());

    // add stalling result handler for `test_blockCache`
    engine.push((_req, res, _next, end) => {
      hitCount += 1;
      res.result = true;
      if (hitCount === 1) {
        setTimeout(end, 100);
      }
    });

    const results = await Promise.all([
      pify(engine.handle).call(engine, {
        id: 1,
        jsonrpc: '2.0',
        method: 'test_blockCache',
        params: [],
      }),
      pify(engine.handle).call(engine, {
        id: 2,
        jsonrpc: '2.0',
        method: 'test_blockCache',
        params: [],
      }),
    ]);

    expect(results[0].result).toEqual(true);
    expect(results[1].result).toEqual(true);
    expect(results[0]).not.toStrictEqual(results[1]); // make sure they are unique responses
    expect(hitCount).toEqual(1); // check result handler was only hit once
  });
});
