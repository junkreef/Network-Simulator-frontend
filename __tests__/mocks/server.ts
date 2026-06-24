import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('/api/v1/topology/deploy', async ({ request }) => {
    try {
      const body = (await request.json()) as any;
      if (body.name && Array.isArray(body.nodes)) {
        return HttpResponse.json({ success: true, message: 'Applied successfully' });
      }
      return new HttpResponse(JSON.stringify({ detail: 'Invalid Schema' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new HttpResponse(JSON.stringify({ detail: 'Parse error' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }),

  http.get('/api/v1/nodes/:id/runtime-info', ({ params, request }) => {
    const url = new URL(request.url);
    const infoType = url.searchParams.get('type') || 'routing_table';
    return HttpResponse.json({
      raw_output: `Mock Output for Node ${params.id} [${infoType}]\n10.0.0.0/24 directly connected\nO* 172.16.0.0/16 via OSPF neighbor`,
    });
  }),

  http.post('/api/v1/nodes/:id/configure', async ({ params, request }) => {
    return HttpResponse.json({
      status: 'success',
      output: `Mock configuration output for ${params.id}`,
    });
  }),

  http.get('/api/v1/topology/state', () => {
    return HttpResponse.json({ nodes: [], edges: [] });
  }),

  http.post('/api/v1/topology/state', async () => {
    return HttpResponse.json({ success: true, message: 'Saved successfully' });
  }),

  http.get('/api/v1/topology/status', () => {
    return HttpResponse.json({ status: 'stopped', nodes: [] });
  }),
];

export const server = setupServer(...handlers);
