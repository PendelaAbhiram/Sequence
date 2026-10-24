// ─────────────────────────────────────────────────────────────────────────────
// Sequence Server – Health & Keep-Alive Endpoint Tests
// ─────────────────────────────────────────────────────────────────────────────

import http from 'http';
import { app } from '../index';

describe('Server Keep-Alive & Health Endpoints', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll((done) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  test('GET /health returns 200 with status ok and cache-control headers', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);

    const cacheHeader = res.headers.get('cache-control');
    expect(cacheHeader).toContain('no-cache');

    const data = await res.json() as any;
    expect(data.status).toBe('ok');
    expect(typeof data.uptime).toBe('number');
    expect(typeof data.activeRooms).toBe('number');
    expect(typeof data.connectedSockets).toBe('number');
    expect(data.service).toContain('Sequence');
  });

  test('HEAD /health returns 200 with no body for fast keep-alive pinging', async () => {
    const res = await fetch(`${baseUrl}/health`, { method: 'HEAD' });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('');
  });

  test('GET /ping returns 200 plain text pong', async () => {
    const res = await fetch(`${baseUrl}/ping`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('pong');
  });
});
