export default function createHitTrackerMiddleware() {
  const hitTracker: any = {};
  const middleware = (req: any, _res: any, next: any, _end: any) => {
    // mark hit for method
    const hitsForMethod = hitTracker[req.method] || [];
    hitsForMethod.push(req);
    hitTracker[req.method] = hitsForMethod;
    // continue
    next();
  };
  middleware.getHits = (method: string) => hitTracker[method] || [];
  return middleware;
}
