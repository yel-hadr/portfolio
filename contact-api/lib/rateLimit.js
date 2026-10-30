// Rate limits for the contact endpoint: a sliding window per client, and one for everyone, so a
// flood can neither fill the inbox nor spend the Resend quota (about 100 emails a day on the free
// plan). They live in this instance's memory: Vercel keeps a warm instance for many requests, so
// they hold for a burst, but a new instance starts afresh. The durable limit is a rate-limit rule
// in Vercel's firewall on /api/contact (see contact-api/README.md).

const MINUTE = 60 * 1000;
// Clients remembered at most, so a flood from many addresses cannot grow the map without end
const MAX_CLIENTS = 5000;

/**
 * @param perClient     messages one client may send per clientWindow
 * @param global        messages everyone together may send per globalWindow
 * @returns (client) => { ok: true } | { ok: false, retryAfter: seconds }
 */
export const createRateLimiter = ({
  perClient = 5,
  clientWindow = 10 * MINUTE,
  global = 30,
  globalWindow = 60 * MINUTE,
  now = Date.now,
} = {}) => {
  const clients = new Map();
  let everyone = [];
  const recent = (times, windowMs, t) => times.filter((at) => t - at < windowMs);
  const wait = (oldest, windowMs, t) => Math.max(1, Math.ceil((oldest + windowMs - t) / 1000));

  return (client) => {
    const t = now();
    everyone = recent(everyone, globalWindow, t);
    if (everyone.length >= global)
      return { ok: false, retryAfter: wait(everyone[0], globalWindow, t) };
    const mine = recent(clients.get(client) ?? [], clientWindow, t);
    if (mine.length >= perClient) {
      clients.set(client, mine);
      return { ok: false, retryAfter: wait(mine[0], clientWindow, t) };
    }
    mine.push(t);
    everyone.push(t);
    clients.delete(client);
    clients.set(client, mine);
    // The map keeps insertion order: the least recently seen clients go first
    while (clients.size > MAX_CLIENTS) clients.delete(clients.keys().next().value);
    return { ok: true };
  };
};

/** The client's address as Vercel's edge reports it (it sets x-forwarded-for itself) */
export const clientOf = (request) =>
  request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
  request.headers.get('x-real-ip') ||
  'unknown';
