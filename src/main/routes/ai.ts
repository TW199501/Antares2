import { FastifyInstance } from 'fastify';

export default async function aiRoutes (app: FastifyInstance) {
   // POST /api/ai/translate-column
   // Translates a snake_case column name into a short Traditional Chinese description
   // Body: { columnName: string, tableName?: string, apiKey: string }
   app.post('/api/ai/translate-column', async (request) => {
      const { columnName, tableName, apiKey } = request.body as {
         columnName: string;
         tableName?: string;
         apiKey: string;
      };

      if (!apiKey)
         throw new Error('AI API key not configured. Please set it in Settings.');

      if (!columnName)
         throw new Error('columnName is required');

      const contextLine = tableName ? `Table: ${tableName}\n` : '';
      const prompt = `${contextLine}Column: ${columnName}\n\nGenerate a concise Traditional Chinese description (6-10 characters) for this database column. Output only the description text, nothing else.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
         method: 'POST',
         headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
         },
         body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 64,
            messages: [{ role: 'user', content: prompt }]
         })
      });

      if (!response.ok) {
         const err = await response.text();
         throw new Error(`AI API error ${response.status}: ${err}`);
      }

      const data = await response.json() as { content: { text: string }[] };
      const description = data.content?.[0]?.text?.trim() ?? '';

      return { description };
   });
}
