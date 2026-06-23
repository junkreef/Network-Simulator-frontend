import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('/api/v1/topology', async ({ request }) => {
    try {
      const body = (await request.json()) as any;
      if (body.topology_id && Array.isArray(body.nodes)) {
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

  http.get('/api/v1/nodes/:id/status', ({ params, request }) => {
    const url = new URL(request.url);
    const infoType = url.searchParams.get('type') || 'routing_table';
    return HttpResponse.json({
      output: `Mock Output for Node ${params.id} [${infoType}]\n10.0.0.0/24 directly connected\nO* 172.16.0.0/16 via OSPF neighbor`,
    });
  }),
];

export const server = setupServer(...handlers);
