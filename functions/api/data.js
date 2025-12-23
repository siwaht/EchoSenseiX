export async function onRequest(context) {
    const db = context.env.DB;

    if (context.request.method === 'GET') {
        try {
            // GET all records
            const { results } = await db.prepare('SELECT * FROM users').all();
            return new Response(JSON.stringify(results), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
    }

    if (context.request.method === 'POST') {
        try {
            // POST new record
            const body = await context.request.json();
            const result = await db.prepare(
                'INSERT INTO users (name, email) VALUES (?, ?)'
            ).bind(body.name, body.email).run();

            return new Response(JSON.stringify(result), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
    }

    return new Response('Method not allowed', { status: 405 });
}
