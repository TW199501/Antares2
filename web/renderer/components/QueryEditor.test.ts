/**
 * Tests for QueryEditor.vue — the SQL editor used in workspace query tabs
 * and routine bodies. Wraps `ace-builds` like BaseTextEditor does, but adds:
 *   - workspace-aware autocomplete (tables / triggers / procedures /
 *     functions / schedulers / fields per schema)
 *   - mode resolution by client (mysql / pgsql / sql)
 *   - watchers on theme / fontSize / autoComplete / lineWrap from settings
 *   - lastSchema watch that re-installs custom completer
 *
 * Like BaseTextEditor.test.ts, we mock both `ace-builds` and the
 * `ace-builds/esm-resolver` URL-loader. The libs/ext-language_tools side-
 * effect import is ALSO mocked because it touches the global `ace`. Tests
 * pin the wrapper contract: mount + renders editor wrapper id; ace.edit
 * called with mode + value; session.on('change') wires update:modelValue.
 *
 * We do NOT exercise the full afterExec flow (autocomplete trigger ladder)
 * — that would require an editable tablesInQuery state plus IPC fan-in.
 */
import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import * as ace from 'ace-builds';
import { describe, expect, it, vi } from 'vitest';

import QueryEditor from './QueryEditor.vue';

// Capture session.on('change') handlers so the test can drive update:modelValue.
const sessionListeners: Record<string, ((...args: unknown[]) => void)[]> = {};

const editorMock = {
   setValue: vi.fn(),
   getValue: vi.fn(() => 'SELECT * FROM users'),
   on: vi.fn(),
   destroy: vi.fn(),
   setTheme: vi.fn(),
   setOptions: vi.fn(),
   focus: vi.fn(),
   resize: vi.fn(),
   getCursorPosition: vi.fn(() => ({ row: 0, column: 0 })),
   execCommand: vi.fn(),
   completers: [] as unknown[],
   commands: {
      removeCommand: vi.fn(),
      on: vi.fn()
   },
   session: {
      setMode: vi.fn(),
      setValue: vi.fn(),
      getBreakpoints: vi.fn(() => []),
      setBreakpoint: vi.fn(),
      clearBreakpoint: vi.fn(),
      doc: {
         positionToIndex: vi.fn(() => 0)
      },
      on: vi.fn((evt: string, cb: (...args: unknown[]) => void) => {
         (sessionListeners[evt] ||= []).push(cb);
      })
   }
};

vi.mock('ace-builds', () => ({
   edit: vi.fn(() => editorMock)
}));
vi.mock('ace-builds/esm-resolver', () => ({}));
vi.mock('../libs/ext-language_tools', () => ({}));

vi.mock('@/ipc-api/Tables', () => ({
   default: {
      getTableColumns: vi.fn().mockResolvedValue({
         status: 'success',
         response: [{ name: 'id' }, { name: 'email' }]
      })
   }
}));

const baseWorkspace = {
   uid: 'C:1',
   client: 'mysql',
   structure: [
      {
         name: 'app',
         tables: [{ name: 'users', type: 'table' }],
         triggers: [],
         procedures: [],
         functions: [],
         schedulers: []
      }
   ]
};

function mountEditor (props: Record<string, unknown> = {}) {
   const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn });
   return mount(QueryEditor, {
      props: {
         modelValue: '',
         workspace: baseWorkspace,
         schema: 'app',
         isSelected: true,
         readOnly: false,
         autoFocus: false,
         height: 200,
         ...props
      },
      global: { plugins: [pinia] }
   } as Parameters<typeof mount>[1]);
}

describe('QueryEditor', () => {
   it('exports the component as an SFC object', () => {
      expect(QueryEditor).toBeDefined();
      expect(typeof QueryEditor).toBe('object');
   });

   it('mounts without throwing under default workspace + schema', () => {
      expect(() => mountEditor()).not.toThrow();
   });

   it('renders the .editor element with a generated id and the height style', () => {
      const wrapper = mountEditor({ height: 350 });
      const editorEl = wrapper.find('.editor');
      expect(editorEl.exists()).toBe(true);
      expect(editorEl.attributes('id')).toMatch(/^editor-/);
      expect(editorEl.attributes('style')).toContain('height: 350px');
   });

   it('initializes ace.edit with mysql mode + provided modelValue', () => {
      mountEditor({ modelValue: 'SELECT 1', workspace: { ...baseWorkspace, client: 'mysql' } });
      expect(ace.edit).toHaveBeenCalled();
      const lastCall = (ace.edit as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)!;
      const opts = lastCall[1];
      expect(opts.mode).toBe('ace/mode/mysql');
      expect(opts.value).toBe('SELECT 1');
      expect(opts.readOnly).toBe(false);
   });

   it('uses pgsql mode for client=pg', () => {
      mountEditor({ workspace: { ...baseWorkspace, client: 'pg' } });
      const lastCall = (ace.edit as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)!;
      expect(lastCall[1].mode).toBe('ace/mode/pgsql');
   });

   it('falls back to "sql" mode for unknown clients (e.g. sqlite)', () => {
      mountEditor({ workspace: { ...baseWorkspace, client: 'sqlite' } });
      const lastCall = (ace.edit as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)!;
      expect(lastCall[1].mode).toBe('ace/mode/sql');
   });

   it('forwards readOnly:true through to ace.edit options', () => {
      mountEditor({ readOnly: true });
      const lastCall = (ace.edit as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)!;
      expect(lastCall[1].readOnly).toBe(true);
   });

   it('emits update:modelValue when the session change handler fires', async () => {
      for (const k of Object.keys(sessionListeners)) sessionListeners[k] = [];
      editorMock.getValue.mockReturnValueOnce('UPDATE x SET a=1');
      const wrapper = mountEditor();
      const handlers = sessionListeners.change ?? [];
      expect(handlers.length).toBeGreaterThan(0);
      handlers.forEach(h => h());
      await wrapper.vm.$nextTick();
      const events = wrapper.emitted('update:modelValue');
      expect(events).toBeTruthy();
      expect(events![0]).toEqual(['UPDATE x SET a=1']);
   });

   it('exposes the editor instance via defineExpose', async () => {
      const wrapper = mountEditor();
      // defineExpose({ editor }) → accessible on the wrapper.vm
      // Cast: wrapper.vm typing is the public exposed surface of <script setup>.
      const exposed = wrapper.vm as unknown as { editor: unknown };
      expect(exposed.editor).toBeDefined();
   });
});
