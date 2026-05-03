import { FastifyInstance } from 'fastify';

/**
 * Translate a column name into the user's UI locale using the unofficial
 * public Google Translate endpoint (no API key required).
 *
 * This replaced an earlier Claude Haiku-based generator that needed
 * `settings.aiApiKey`. The user explicitly opted out of paid keys for the
 * description-translate feature.
 *
 * Tradeoff: this endpoint is `client=gtx` which is the same one used by
 * the public translate.google.com web UI. It works without auth but has
 * no SLA; on heavy bursts Google may IP-throttle. We surface the failure
 * verbatim so the user knows when to retry.
 *
 * Response shape kept compatible with the previous /translate-column so
 * the renderer doesn't need a different handler — `{ description }`.
 */
export default async function aiRoutes (app: FastifyInstance) {
   app.post('/api/ai/translate-column', async (request) => {
      const { columnName, targetLocale } = request.body as {
         columnName: string;
         targetLocale: string;
      };

      if (!columnName) throw new Error('columnName is required');
      const target = (targetLocale || 'zh-TW').trim();

      // Convert snake_case / kebab-case / camelCase to space-separated words
      // so Google Translate sees natural phrases, not unsplit identifiers.
      const phrase = columnName
         .replace(/[_-]+/g, ' ')
         .replace(/([a-z])([A-Z])/g, '$1 $2')
         .toLowerCase()
         .trim();

      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(phrase)}`;

      const response = await fetch(url, {
         method: 'GET',
         headers: { 'user-agent': 'Mozilla/5.0' }
      });

      if (!response.ok) {
         const err = await response.text();
         throw new Error(`Google Translate error ${response.status}: ${err.slice(0, 200)}`);
      }

      // Google returns a deeply nested array; sentence translations live in
      // result[0][i][0]. Concatenate all sentences for multi-segment input.
      const data = await response.json() as unknown[][];
      const segments = (data[0] as unknown[][]) ?? [];
      const description = segments.map(s => s[0]).join('').trim();

      if (!description) throw new Error('Empty translation result');

      return { description };
   });
}
