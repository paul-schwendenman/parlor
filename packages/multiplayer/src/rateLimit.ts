export const RATE_LIMIT_MESSAGE = 'Too many requests. Try again shortly.';

interface Bucket {
  tokens: number;
  updatedAt: number;
}

interface SocketBuckets {
  general: Bucket;
  roomLookup: Bucket;
}

const sockets = new WeakMap<object, SocketBuckets>();

function take(bucket: Bucket, capacity: number, perSecond: number, now: number): boolean {
  bucket.tokens = Math.min(capacity, bucket.tokens + (now - bucket.updatedAt) * perSecond / 1000);
  bucket.updatedAt = now;
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

/** Join and spectate share an additional bucket to bound room-code lookups. */
export function allowSocketRequest(socket: object, roomLookup = false): boolean {
  const now = performance.now();
  let buckets = sockets.get(socket);
  if (!buckets) {
    buckets = {
      general: { tokens: 80, updatedAt: now },
      roomLookup: { tokens: 6, updatedAt: now },
    };
    sockets.set(socket, buckets);
  }

  // Rejected lookups spend only the lookup budget, leaving ordinary play usable.
  if (roomLookup && !take(buckets.roomLookup, 6, 2, now)) return false;
  return take(buckets.general, 80, 20, now);
}
