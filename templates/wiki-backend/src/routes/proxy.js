import { Router } from 'express';

export function createProxyRouter({ targetApiBaseUrl }) {
  const router = Router();

  /**
   * POST /api/proxy
   * body: { method: 'GET'|'POST'|..., path: '/some/path?query=1', headers?: Record<string,string>, body?: object }
   *
   * Forwards the request server-side to targetApiBaseUrl + path, so the
   * wiki-site frontend never makes the cross-origin call itself (this is
   * what eliminates the old CORS-limited sandbox - see issue #286). The
   * target base URL is fixed server-side (this deployment's own config),
   * never taken from the client request, so this endpoint can't be used as
   * an open proxy to an arbitrary host. Auth is whatever header(s) the
   * client sent in `headers` (typed in by whoever is using the sandbox at
   * QA time) - this route just attaches them to the upstream request
   * before forwarding, it never stores or logs them.
   */
  router.post('/proxy', async (req, res) => {
    const { method = 'GET', path = '/', headers = {}, body } = req.body ?? {};

    if (!targetApiBaseUrl) {
      return res.status(500).json({ error: 'This wiki-backend instance has no TARGET_API_BASE_URL configured.' });
    }
    if (typeof path !== 'string' || !path.startsWith('/')) {
      return res.status(400).json({ error: 'body.path must be a string starting with "/".' });
    }

    const url = `${targetApiBaseUrl.replace(/\/$/, '')}${path}`;
    const upstreamHeaders = { 'Content-Type': 'application/json', ...headers };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const upstreamRes = await fetch(url, {
        method,
        headers: upstreamHeaders,
        body: method === 'GET' || method === 'HEAD' || body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await upstreamRes.text();
      let parsedBody;
      try {
        parsedBody = JSON.parse(text);
      } catch {
        parsedBody = text;
      }
      res.json({ status: upstreamRes.status, body: parsedBody });
    } catch (err) {
      const timedOut = err?.name === 'AbortError';
      res.status(502).json({ error: timedOut ? 'Upstream request timed out after 30s.' : `Error reaching upstream API: ${err.message}` });
    } finally {
      clearTimeout(timeout);
    }
  });

  return router;
}
