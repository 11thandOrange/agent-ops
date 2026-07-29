import express from 'express';
import cors from 'cors';
import { createProxyRouter } from './routes/proxy.js';

const PORT = process.env.PORT ?? 8787;
const TARGET_API_BASE_URL = process.env.TARGET_API_BASE_URL ?? '';
// Comma-separated list of origins allowed to call this proxy - set to the
// deployed wiki-site's own origin(s). Never '*' with credentials, since
// this endpoint can carry user-supplied auth headers through to the
// upstream API.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : true,
  })
);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/', (_req, res) => res.json({ name: 'wiki-backend', version: '0.1.0', targetConfigured: Boolean(TARGET_API_BASE_URL) }));

app.use('/api', createProxyRouter({ targetApiBaseUrl: TARGET_API_BASE_URL }));

app.listen(PORT, () => {
  console.log(`wiki-backend listening on :${PORT} (target=${TARGET_API_BASE_URL || '(unset)'})`);
});
