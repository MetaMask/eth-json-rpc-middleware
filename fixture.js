module.exports = fixture

function fixture(staticResponses){
  staticResponses = staticResponses || {}

  return (req, res, next, end) => {
    const self = this
    staticResponses = staticResponses || {}
    self.staticResponses = staticResponses
    var staticResponse = self.staticResponses[req.method]
      // async function
    if ('function' === typeof staticResponse) {
    staticResponse(req, next, end)
     // static response - null is valid response
    } else if (staticResponse !== undefined) {
    // return result asynchronously
    setTimeout(() => end(null, staticResponse))
  // no prepared response - skip
  } else {
    next()
  }
  }
}

