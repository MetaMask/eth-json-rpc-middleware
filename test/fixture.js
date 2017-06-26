const test = require('tape')
const JsonRpcEngine = require('json-rpc-engine')
const fixture = require('../fixture')


test('fixture', (t) => {

    const engine = new JsonRpcEngine()
    let res1, res2

    engine.push(fixture({
        net_listening: true,
        eth_hashrate: '0x00',
        eth_mining: false,
    }))



    engine.handle({ method: 'net_listening', params: [] }, firstReqResponse)

    engine.handle({ method: 'eth_hashrate', params: [] }, secondReqResponse)

    function firstReqResponse(err, res) {
        res1 = res
        t.notOk(err, 'No error in response')
        t.ok(res, 'Has response')
        t.equal(res.result, true, 'Response result is correct.')
    }

    function secondReqResponse(err, res) {
        res2 = res
        t.notOk(err, 'No error in response')
        t.ok(res, 'Has response')
        t.equal(res.result, '0x00', 'Response result is correct.')
        t.end()
    }


})




