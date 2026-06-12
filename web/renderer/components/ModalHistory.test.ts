/**
 * Tests for ModalHistory.vue — the "Query History" dialog. Owns:
 *   - Dialog shell (esc / overlay / X-close → emit('close'))
 *   - Search bar with debounced (200 ms) localSearchTerm watcher
 *   - BaseVirtualScroll-driven list of HistoryRecord rows
 *   - Per-row Select / Copy / Delete actions
 *   - Empty-state placeholder when history is []
 *   - keydown listener on window (Escape closes)
 *
 * BaseVirtualScroll passthrough exposes updateWindow() via methods so
 * resultTable.value.updateWindow() in resizeResults() does not throw. The
 * Dialog/DialogContent/Header/Title/Description tree is replaced with
 * passthrough divs (per ModalProcessesList test convention) — we don't probe
 * reka-ui internals, just rendered DOM + emitted events.
 *
 * Spec §5.A — reka-ui internals stubbed.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { copyText } from '@/libs/copyText';

import ModalHistory from './ModalHistory.vue';

vi.mock('@/libs/copyText', () => ({
   copyText: vi.fn()
}));

// sql-highlight returns a string when {html: true}; identity-stub keeps the
// rendered query body deterministic (and avoids regex highlighting noise).
vi.mock('sql-highlight', () => ({
   highlight: (s: string) => s
}));

const BaseVirtualScrollStub = {
   name: 'BaseVirtualScroll',
   props: ['items', 'itemHeight', 'visibleHeight', 'scrollElement'],
   data () {
      return { updateWindowCalls: 0 };
   },
   methods: {
      updateWindow () {
         (this as { updateWindowCalls: number }).updateWindowCalls++;
      }
   },
   template: `
      <div class="virtual-scroll-stub" :data-count="items.length">
         <slot :items="items" />
      </div>
   `
};

const baseConnection = { uid: 'C:1', client: 'mysql', name: 'local-mysql' };

const baseConnections = [
   { uid: 'C:1', name: 'local-mysql', client: 'mysql' }
];

const baseHistoryRows = [
   { uid: 'H:1', sql: 'SELECT 1', date: new Date('2026-05-01T10:00:00Z'), schema: 'app' },
   { uid: 'H:2', sql: 'SELECT 2', date: new Date('2026-05-02T10:00:00Z'), schema: 'app' },
   { uid: 'H:3', sql: 'UPDATE orders SET status = 1', date: new Date('2026-05-03T10:00:00Z'), schema: 'app' }
];

const mountModal = (
   propOverrides: Record<string, unknown> = {},
   stateOverrides: Record<string, unknown> = {}
) => {
   const defaultHistory = stateOverrides.history === undefined
      ? { 'C:1': baseHistoryRows }
      : stateOverrides.history as Record<string, unknown>;

   return mountWithPinia(ModalHistory, {
      props: {
         connection: baseConnection,
         ...propOverrides
      } as never,
      initialState: {
         connections: {
            connections: baseConnections,
            connectionsOrder: baseConnections.map(c => ({ ...c, isFolder: false })),
            customIcons: []
         },
         history: {
            history: defaultHistory,
            favorites: {}
         },
         notifications: { notifications: [] }
      },
      stubActions: true,
      attachTo: document.body,
      global: {
         stubs: {
            BaseIcon: true,
            BaseVirtualScroll: BaseVirtualScrollStub,
            Dialog: { template: '<div class="dialog-stub"><slot /></div>' },
            DialogContent: { template: '<div class="dialog-content-stub"><slot /></div>' },
            DialogHeader: { template: '<div class="dialog-header-stub"><slot /></div>' },
            DialogTitle: { template: '<div class="dialog-title-stub"><slot /></div>' },
            DialogDescription: { template: '<div class="dialog-description-stub"><slot /></div>' },
            Button: {
               name: 'Button',
               inheritAttrs: false,
               template: '<button type="button" class="btn-stub" v-bind="$attrs"><slot /></button>'
            },
            Input: {
               name: 'Input',
               inheritAttrs: false,
               props: { modelValue: { type: [String, Number, null] as never, default: '' } },
               emits: ['update:modelValue'],
               template: '<input class="input-stub" v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', ($event.target as HTMLInputElement).value)" />'
            }
         }
      }
   });
};

describe('ModalHistory', () => {
   it('exports the component as an SFC object', () => {
      expect(ModalHistory).toBeDefined();
      expect(typeof ModalHistory).toBe('object');
   });

   it('renders the empty-state placeholder when no history exists for the workspace', async () => {
      const wrapper = mountModal({}, { history: {} });
      await flushPromises();
      // empty state shows the dormant-history copy and hides the search bar
      expect(wrapper.html()).toContain('database.thereAreNoQueriesYet');
      expect(wrapper.find('.virtual-scroll-stub').exists()).toBe(false);
      // the search Input only renders when history.length > 0
      expect(wrapper.find('.input-stub').exists()).toBe(false);
   });

   it('copyText IPC mock surface is wired', () => {
      expect(typeof copyText).toBe('function');
   });
});
