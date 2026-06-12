/**
 * Tests for DebugConsole.vue — bottom-anchored query+debug log panel. Despite
 * its filename it's NOT a modal — it's an inline docked panel with a vertical
 * resizer handle. Owns:
 *   - shadcn Tabs (query / debug) with Pinia-backed selectedTab two-way bind
 *   - Per-row ContextMenu wrapping each log entry → right-click → Copy
 *   - Resizer mousedown listener + mousemove / mouseup pair
 *   - Auto-scroll-to-bottom on log mutations / consoleHeight change
 *   - Refresh + DevTools buttons gated by isDevelopment
 *
 * Spec §5.A — reka-ui Tabs / ContextMenu replaced with passthrough stubs so
 * we never rely on portal traversal. Pinia console store seeded with logs.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import DebugConsole from './DebugConsole.vue';

vi.mock('sql-highlight', () => ({
   highlight: (sql: string) => sql
}));

vi.mock('@/libs/copyText', () => ({
   copyText: vi.fn()
}));

const baseQueryLogs = [
   { cUid: 'C:1', sql: 'SELECT 1', date: new Date('2026-05-06T12:00:00Z') },
   { cUid: 'C:1', sql: 'SELECT 2', date: new Date('2026-05-06T12:00:01Z') },
   { cUid: 'C:2', sql: 'SELECT 99', date: new Date('2026-05-06T12:00:02Z') }
];

const baseDebugLogs = [
   { level: 'log', process: 'renderer', message: 'hello', date: new Date('2026-05-06T12:00:00Z') },
   { level: 'warn', process: 'main', message: 'warn-msg', date: new Date('2026-05-06T12:00:01Z') },
   { level: 'error', process: 'worker', message: 'boom', date: new Date('2026-05-06T12:00:02Z') }
];

const TabsStub = {
   props: ['modelValue'],
   emits: ['update:modelValue'],
   template: '<div class="tabs-stub" :data-value="modelValue"><slot /></div>'
};
const TabsListStub = { template: '<div class="tabs-list-stub"><slot /></div>' };
const TabsTriggerStub = {
   props: ['value'],
   template: '<button type="button" class="tabs-trigger-stub" :data-value="value"><slot /></button>'
};
const TabsContentStub = {
   props: ['value'],
   template: '<div class="tabs-content-stub" :data-value="value"><slot /></div>'
};

const ContextMenuStub = { template: '<div class="ctx-menu-stub"><slot /></div>' };
const ContextMenuTriggerStub = { template: '<div class="ctx-trigger-stub"><slot /></div>' };
const ContextMenuContentStub = { template: '<div class="ctx-content-stub"><slot /></div>' };
const ContextMenuItemStub = {
   emits: ['select'],
   template: '<button type="button" class="ctx-item-stub" @click="$emit(\'select\')"><slot /></button>'
};

const ButtonStub = {
   name: 'Button',
   inheritAttrs: false,
   template: '<button type="button" class="btn-stub" v-bind="$attrs"><slot /></button>'
};

const mountConsole = (
   propOverrides: Record<string, unknown> = {},
   stateOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(DebugConsole, {
      props: {
         uid: 'C:1',
         ...propOverrides
      } as never,
      initialState: {
         console: {
            isConsoleOpen: true,
            queryLogs: baseQueryLogs,
            debugLogs: baseDebugLogs,
            selectedTab: 'query',
            consoleHeight: 200,
            ...stateOverrides
         }
      },
      stubActions: true,
      global: {
         stubs: {
            BaseIcon: true,
            Button: ButtonStub,
            Tabs: TabsStub,
            TabsList: TabsListStub,
            TabsTrigger: TabsTriggerStub,
            TabsContent: TabsContentStub,
            ContextMenu: ContextMenuStub,
            ContextMenuTrigger: ContextMenuTriggerStub,
            ContextMenuContent: ContextMenuContentStub,
            ContextMenuItem: ContextMenuItemStub
         }
      }
   });
};

describe('DebugConsole', () => {
   it('exports the component definition', () => {
      expect(DebugConsole).toBeDefined();
      expect(typeof DebugConsole).toBe('object');
   });

   it('mounts the .console-wrapper root element', async () => {
      const wrapper = mountConsole();
      await flushPromises();
      expect(wrapper.find('.console-wrapper').exists()).toBe(true);
      expect(wrapper.find('.console-resizer').exists()).toBe(true);
      expect(wrapper.find('.console').exists()).toBe(true);
   });

   it('renders the Tabs root with selectedTab="query" by default', async () => {
      const wrapper = mountConsole();
      await flushPromises();
      const tabsRoot = wrapper.find('.tabs-stub');
      expect(tabsRoot.exists()).toBe(true);
      expect(tabsRoot.attributes('data-value')).toBe('query');
   });

   it('renders both tab triggers (query + debug)', async () => {
      const wrapper = mountConsole();
      await flushPromises();
      const triggers = wrapper.findAll('.tabs-trigger-stub');
      expect(triggers.length).toBe(2);
      const values = triggers.map(t => t.attributes('data-value'));
      expect(values).toEqual(['query', 'debug']);
      expect(wrapper.html()).toContain('application.executedQueries');
      expect(wrapper.html()).toContain('application.debugConsole');
   });

   it('renders only the query logs whose cUid matches props.uid', async () => {
      const wrapper = mountConsole();
      await flushPromises();
      // 2 query logs for C:1 → 2 console-log rows in query tab
      const queryContent = wrapper.find('.tabs-content-stub[data-value="query"]');
      expect(queryContent.exists()).toBe(true);
      const queryLogs = queryContent.findAll('.console-log');
      expect(queryLogs.length).toBe(2);
      expect(queryContent.html()).toContain('SELECT 1');
      expect(queryContent.html()).toContain('SELECT 2');
      expect(queryContent.html()).not.toContain('SELECT 99');
   });

   it('renders all debug logs in the debug tab content', async () => {
      const wrapper = mountConsole();
      await flushPromises();
      const debugContent = wrapper.find('.tabs-content-stub[data-value="debug"]');
      expect(debugContent.exists()).toBe(true);
      const debugLogRows = debugContent.findAll('.console-log');
      expect(debugLogRows.length).toBe(3);
      expect(debugContent.html()).toContain('hello');
      expect(debugContent.html()).toContain('warn-msg');
      expect(debugContent.html()).toContain('boom');
   });

   it('applies console-log-level-warn / -error classes to the log message', async () => {
      const wrapper = mountConsole();
      await flushPromises();
      const debugContent = wrapper.find('.tabs-content-stub[data-value="debug"]');
      expect(debugContent.html()).toContain('console-log-level-warn');
      expect(debugContent.html()).toContain('console-log-level-error');
      expect(debugContent.html()).toContain('console-log-level-log');
   });

   it('renders the close button', async () => {
      const wrapper = mountConsole();
      await flushPromises();
      // Title attribute for close button is general.close
      expect(wrapper.html()).toContain('general.close');
   });

   it('renders no query logs when uid prop matches no entries', async () => {
      const wrapper = mountConsole({ uid: 'C:never' });
      await flushPromises();
      const queryContent = wrapper.find('.tabs-content-stub[data-value="query"]');
      expect(queryContent.findAll('.console-log').length).toBe(0);
   });

   it('renders nothing for query logs when store has no query entries', async () => {
      const wrapper = mountConsole({}, { queryLogs: [], debugLogs: [] });
      await flushPromises();
      // Both tabs render empty
      expect(wrapper.findAll('.console-log').length).toBe(0);
   });

   it('localHeight tracks consoleHeight value via inline style', async () => {
      const wrapper = mountConsole({}, { consoleHeight: 300 });
      await flushPromises();
      const consoleEl = wrapper.find('#console');
      expect(consoleEl.exists()).toBe(true);
      expect(consoleEl.attributes('style')).toContain('300px');
   });

   it('cleans up on unmount without throwing', async () => {
      const wrapper = mountConsole();
      await flushPromises();
      expect(() => wrapper.unmount()).not.toThrow();
   });
});
