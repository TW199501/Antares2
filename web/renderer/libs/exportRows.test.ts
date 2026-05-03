/**
 * Characterization tests for `exportRows` — converts rows to CSV/JSON/SQL/PHP and
 * triggers a browser download via a synthetic `<a download>` element.
 *
 * Locked behavior:
 *   - Always creates a Blob with a format-specific MIME type and an `<a>` element
 *     whose `download` is `<targetTable|table>[-<page>].<type>`.
 *   - CSV: optional header row, configurable field delimiter, configurable line
 *     terminator (escapes "\\n"/"\\r" → real \n/\r), string delimiter chooses
 *     '/"/'' wrapping. Date → moment "YYYY-MM-DD HH:mm:ss". Buffer/Uint8Array →
 *     base64. Numbers/booleans pass through via Array.join string coercion.
 *   - JSON: 3-space indented JSON.stringify of `args.content`.
 *   - SQL: delegates to `jsonToSqlInsert` with options.targetTable preferred
 *     over args.table.
 *   - PHP: json2php printer, then wraps as `<?php\n$<table> = <expr>;` —
 *     hyphens in the table name are converted to underscores for the variable.
 *   - Page suffix appears only when `args.page` is truthy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { exportRows } from './exportRows';

interface CapturedDownload {
   blob: Blob;
   mime: string;
   href: string;
   download: string;
   clicked: boolean;
}

let captured: CapturedDownload | null;
let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
let createElementSpy: ReturnType<typeof vi.spyOn>;

const readBlobText = async (blob: Blob): Promise<string> => {
   // happy-dom 20 implements Blob.text()
   return await blob.text();
};

beforeEach(() => {
   captured = null;

   createObjectURLSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementation((b: Blob | MediaSource) => {
         if (b instanceof Blob) {
            captured = {
               blob: b,
               mime: b.type,
               href: 'blob:mock://download',
               download: '',
               clicked: false
            };
         }
         return 'blob:mock://download';
      });

   const realCreate = document.createElement.bind(document);
   createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string) => {
         const el = realCreate(tagName) as HTMLElement;
         if (tagName.toLowerCase() === 'a') {
            const link = el as HTMLAnchorElement;
            // capture download/click without actually navigating
            link.click = () => {
               if (captured) {
                  captured.download = link.download;
                  captured.clicked = true;
               }
            };
         }
         return el;
      });
});

afterEach(() => {
   createObjectURLSpy.mockRestore();
   createElementSpy.mockRestore();
});

describe('exportRows — JSON', () => {
   it('serializes content with 3-space indentation and application/json MIME', async () => {
      const rows = [{ id: 1, name: 'Eddie' }, { id: 2, name: 'Ada' }];
      exportRows({ type: 'json', content: rows, table: 'users' });
      expect(captured).not.toBeNull();
      expect(captured!.mime).toBe('application/json');
      expect(await readBlobText(captured!.blob)).toBe(JSON.stringify(rows, null, 3));
      expect(captured!.download).toBe('users.json');
      expect(captured!.clicked).toBe(true);
   });

   it('appends -<page> to the filename when page is provided', async () => {
      exportRows({ type: 'json', content: [{ a: 1 }], table: 'users', page: 7 });
      expect(captured!.download).toBe('users-7.json');
   });

   it('omits the page suffix when page is 0 (falsy)', async () => {
      exportRows({ type: 'json', content: [{ a: 1 }], table: 'users', page: 0 });
      expect(captured!.download).toBe('users.json');
   });

   it('handles empty content array as a JSON empty array', async () => {
      exportRows({ type: 'json', content: [], table: 'empty' });
      expect(await readBlobText(captured!.blob)).toBe('[]');
   });
});

describe('exportRows — CSV', () => {
   const baseCsv = {
      header: true,
      fieldDelimiter: ',',
      linesTerminator: '\\r\\n',
      stringDelimiter: 'double' as const
   };

   it('emits header row + data rows joined by \\r\\n with double-quoted strings', async () => {
      exportRows({
         type: 'csv',
         content: [
            { id: 1, name: 'Eddie' },
            { id: 2, name: 'Ada' }
         ],
         table: 'users',
         csvOptions: baseCsv
      });
      expect(captured!.mime).toBe('text/csv');
      const text = await readBlobText(captured!.blob);
      expect(text).toBe('id,name\r\n1,"Eddie"\r\n2,"Ada"');
      expect(captured!.download).toBe('users.csv');
   });

   it('skips the header row when csvOptions.header is false', async () => {
      exportRows({
         type: 'csv',
         content: [{ id: 1, name: 'Eddie' }],
         table: 'users',
         csvOptions: { ...baseCsv, header: false }
      });
      expect(await readBlobText(captured!.blob)).toBe('1,"Eddie"');
   });

   it('uses single-quote wrapping when stringDelimiter is "single"', async () => {
      exportRows({
         type: 'csv',
         content: [{ name: 'Eddie' }],
         table: 't',
         csvOptions: { ...baseCsv, stringDelimiter: 'single', header: false }
      });
      expect(await readBlobText(captured!.blob)).toBe('\'Eddie\'');
   });

   it('omits string wrapping when stringDelimiter is neither "single" nor "double"', async () => {
      exportRows({
         type: 'csv',
         content: [{ name: 'Eddie' }],
         table: 't',
         // any other value -> falsy 'sd' -> no wrapping
         csvOptions: { ...baseCsv, stringDelimiter: 'none', header: false }
      });
      expect(await readBlobText(captured!.blob)).toBe('Eddie');
   });

   it('uses tab field delimiter when configured', async () => {
      exportRows({
         type: 'csv',
         content: [{ id: 1, name: 'Eddie' }],
         table: 't',
         csvOptions: { ...baseCsv, fieldDelimiter: '\t', header: true }
      });
      expect(await readBlobText(captured!.blob)).toBe('id\tname\r\n1\t"Eddie"');
   });

   it('serializes Date values via moment YYYY-MM-DD HH:mm:ss with quote wrapping', async () => {
      const d = new Date(2026, 4, 3, 12, 30, 45); // local time — moment formats local
      exportRows({
         type: 'csv',
         content: [{ when: d }],
         table: 't',
         csvOptions: { ...baseCsv, header: false }
      });
      expect(await readBlobText(captured!.blob)).toBe('"2026-05-03 12:30:45"');
   });

   it('serializes Uint8Array cells to base64 (no quote wrapping)', async () => {
      // "Hi!" -> base64 "SGkh"
      const bytes = new Uint8Array([72, 105, 33]);
      exportRows({
         type: 'csv',
         content: [{ blob: bytes }],
         table: 't',
         csvOptions: { ...baseCsv, header: false }
      });
      expect(await readBlobText(captured!.blob)).toBe('SGkh');
   });

   it('passes through numbers and booleans (string-coerced by Array.join)', async () => {
      exportRows({
         type: 'csv',
         content: [{ n: 42, b: true, nope: false }],
         table: 't',
         csvOptions: { ...baseCsv, header: false }
      });
      expect(await readBlobText(captured!.blob)).toBe('42,true,false');
   });

   it('passes through null cells as the empty string ("")', async () => {
      // Array.join coerces null to ''
      exportRows({
         type: 'csv',
         content: [{ a: 1, b: null }],
         table: 't',
         csvOptions: { ...baseCsv, header: false }
      });
      expect(await readBlobText(captured!.blob)).toBe('1,');
   });

   it('escapes literal "\\n" / "\\r" sequences in linesTerminator to real newlines', async () => {
      exportRows({
         type: 'csv',
         content: [{ a: 1 }, { a: 2 }],
         table: 't',
         csvOptions: { ...baseCsv, linesTerminator: '\\n', header: false }
      });
      expect(await readBlobText(captured!.blob)).toBe('1\n2');
   });

   it('produces an empty body when content is empty (no header, no rows)', async () => {
      exportRows({
         type: 'csv',
         content: [],
         table: 't',
         csvOptions: baseCsv
      });
      // No content → no header (guarded by `args.content.length`) → no rows.
      expect(await readBlobText(captured!.blob)).toBe('');
   });

   it('does NOT do CSV-style escaping of comma/quote inside string cells (locked-in quirk)', async () => {
      // The implementation wraps strings in delimiters but does not escape inner quotes
      // or commas. This is documented as known behavior; importing tools must tolerate it.
      exportRows({
         type: 'csv',
         content: [{ raw: 'a,b"c' }],
         table: 't',
         csvOptions: { ...baseCsv, header: false }
      });
      expect(await readBlobText(captured!.blob)).toBe('"a,b"c"');
   });
});

describe('exportRows — SQL', () => {
   it('produces an INSERT INTO using args.table when targetTable is absent', async () => {
      exportRows({
         type: 'sql',
         content: [{ id: 1, name: 'Eddie' }],
         table: 'users',
         client: 'mysql',
         fields: {
            id: { type: 'int', datePrecision: 0 },
            name: { type: 'varchar', datePrecision: 0 }
         },
         sqlOptions: { sqlInsertAfter: 1, sqlInsertDivider: 'rows', targetTable: '' }
      });
      const text = await readBlobText(captured!.blob);
      expect(captured!.mime).toBe('text/sql');
      expect(text.startsWith('INSERT INTO ')).toBe(true);
      expect(text).toContain('`users`');
      expect(text.endsWith(';')).toBe(true);
      expect(captured!.download).toBe('users.sql');
   });

   it('uses sqlOptions.targetTable for both the INSERT body and the filename', async () => {
      exportRows({
         type: 'sql',
         content: [{ id: 1 }],
         table: 'users',
         client: 'mysql',
         fields: { id: { type: 'int', datePrecision: 0 } },
         sqlOptions: { sqlInsertAfter: 1, sqlInsertDivider: 'rows', targetTable: 'users_v2' }
      });
      const text = await readBlobText(captured!.blob);
      expect(text).toContain('`users_v2`');
      expect(captured!.download).toBe('users_v2.sql');
   });

   it('uses Postgres double-quote identifier wrapping when client is "pg"', async () => {
      exportRows({
         type: 'sql',
         content: [{ id: 1 }],
         table: 'users',
         client: 'pg',
         fields: { id: { type: 'int', datePrecision: 0 } },
         sqlOptions: { sqlInsertAfter: 1, sqlInsertDivider: 'rows', targetTable: '' }
      });
      const text = await readBlobText(captured!.blob);
      expect(text).toContain('"users"');
      expect(text).toContain('"id"');
   });
});

describe('exportRows — PHP', () => {
   it('wraps the printer output as `<?php\\n$<table> = <expr>;` and uses application/x-httpd-php MIME', async () => {
      exportRows({
         type: 'php',
         content: [{ id: 1, name: 'Eddie' }],
         table: 'users'
      });
      const text = await readBlobText(captured!.blob);
      expect(captured!.mime).toBe('application/x-httpd-php');
      expect(text.startsWith('<?php\n$users = ')).toBe(true);
      expect(text.endsWith(';')).toBe(true);
      expect(captured!.download).toBe('users.php');
      expect(text).toContain('\'Eddie\'');
   });

   it('replaces hyphens in the table name with underscores in the PHP variable', async () => {
      exportRows({
         type: 'php',
         content: [{ a: 1 }],
         table: 'my-cool-table'
      });
      const text = await readBlobText(captured!.blob);
      // Variable is normalized to my_cool_table; filename keeps the original hyphens.
      expect(text.startsWith('<?php\n$my_cool_table = ')).toBe(true);
      expect(captured!.download).toBe('my-cool-table.php');
   });

   it('prefers sqlOptions.targetTable over args.table for the variable name', async () => {
      exportRows({
         type: 'php',
         content: [{ a: 1 }],
         table: 'users',
         sqlOptions: {
            sqlInsertAfter: 1,
            sqlInsertDivider: 'rows',
            targetTable: 'users_v2'
         }
      });
      const text = await readBlobText(captured!.blob);
      expect(text.startsWith('<?php\n$users_v2 = ')).toBe(true);
      expect(captured!.download).toBe('users_v2.php');
   });
});
