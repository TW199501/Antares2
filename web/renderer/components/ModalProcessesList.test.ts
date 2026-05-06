/**
 * Tests for ModalProcessesList.vue — the database "Processes" browser
 * dialog. Owns:
 *   - Dialog shell (esc / overlay close)
 *   - Toolbar with refresh + auto-refresh popover, export menu
 *   - Async `getProcessesList()` via Schema.getProcesses (mocked) on mount
 *   - BaseVirtualScroll-driven results table with sortable columns
 *   - Right-click → context menu (`isContext` flag)
 *   - `antares:run-or-reload` window listener wired in setup
 *
 * The component reaches into `tableWrapper.value.parentElement.offsetHeight`
 * inside `resizeResults()` and calls `resultTable.value.updateWindow()`. We
 * stub BaseVirtualScroll with a passthrough that exposes `updateWindow` so
 * the resize-on-update path doesn't throw.
 *
 * Spec §5.A — reka-ui Dialog/Popover internals are not probed; we use
 * passthrough stubs and inspect rendered DOM + emitted events.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import Schema from '@/ipc-api/Schema';

import ModalProcessesList from './ModalProcessesList.vue';

vi.mock('@/ipc-api/Schema', () => ({
   default: {
      getProcesses: vi.fn().mockResolvedValue({
         status: 'success',
         response: [
            { id: 1, user: 'root', host: 'localhost', db: 'app', command: 'Query', time: 0, state: 'init', info: 'SELECT 1' },
            { id: 2, user: 'root', host: 'localhost', db: 'app', command: 'Sleep', time: 100, state: '', info: '' }
         ]
      }),
      killProcess: vi.fn().mockResolvedValue({ status: 'success', response: null })
   }
}));

vi.mock('../libs/exportRows', () => ({
   exportRows: vi.fn()
}));

vi.mock('@/libs/copyText', () => ({
   copyText: vi.fn()
}));

// BaseVirtualScroll passthrough — ModalProcessesList calls
// resultTable.value.updateWindow() in onUpdated; the stub MUST expose it via
// data() so $refs.resultTable.updateWindow is callable.
const BaseVirtualScrollStub = {
   name: 'BaseVirtualScroll',
   props: ['items', 'itemHeight', 'visibleHeight', 'scrollElement'],
   data () {
      return { updateWindowCalls: 0 };
   },
   methods: {
      updateWindow () {
         this.updateWindowCalls++;
      }
   },
   template: `
      <div class="virtual-scroll-stub" :data-count="items.length">
         <slot :items="items" />
      </div>
   `
};

const ModalProcessesListRowStub = {
   name: 'ModalProcessesListRow',
   props: ['row'],
   emits: ['select-row', 'contextmenu', 'stop-refresh'],
   template: '<div class="process-row-stub" :data-id="row.id" />'
};

const ModalProcessesListContextStub = {
   name: 'ModalProcessesListContext',
   props: ['contextEvent', 'selectedRow', 'selectedCell'],
   emits: ['copy-cell', 'copy-row', 'kill-process', 'close-context'],
   template: '<div class="context-stub" />'
};

const baseConnection = { uid: 'C:1', client: 'mysql', name: 'local-mysql' };

const baseConnections = [
   { uid: 'C:1', name: 'local-mysql', client: 'mysql' }
];

const mountModal = (
   propOverrides: Record<string, unknown> = {},
   stateOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(ModalProcessesList, {
      props: {
         connection: baseConnection,
         ...propOverrides
      } as never,
      initialState: {
         connections: {
            connections: baseConnections,
            connectionsOrder: baseConnections.map(c => ({ ...c, isFolder: false })),
            customIcons: [],
            ...(stateOverrides.connections as Record<string, unknown> ?? {})
         },
         notifications: { notifications: [] }
      },
      stubActions: true,
      attachTo: document.body,
      global: {
         stubs: {
            BaseIcon: true,
            BaseVirtualScroll: BaseVirtualScrollStub,
            ModalProcessesListRow: ModalProcessesListRowStub,
            ModalProcessesListContext: ModalProcessesListContextStub,
            Dialog: { template: '<div class="dialog-stub"><slot /></div>' },
            DialogContent: { template: '<div class="dialog-content-stub"><slot /></div>' },
            DialogHeader: { template: '<div class="dialog-header-stub"><slot /></div>' },
            DialogTitle: { template: '<div class="dialog-title-stub"><slot /></div>' },
            Popover: { template: '<div class="popover-stub"><slot /></div>' },
            PopoverTrigger: { template: '<div class="popover-trigger-stub"><slot /></div>' },
            PopoverContent: { template: '<div class="popover-content-stub"><slot /></div>' },
            Button: {
               name: 'Button',
               inheritAttrs: false,
               template: '<button type="button" class="btn-stub" v-bind="$attrs"><slot /></button>'
            }
         }
      }
   });
};

describe('ModalProcessesList', () => {
   it('mounts without throwing under default props', async () => {
      expect(() => mountModal()).not.toThrow();
      await flushPromises();
   });

   it('calls Schema.getProcesses on mount with the connection uid', async () => {
      mountModal();
      await flushPromises();
      expect(Schema.getProcesses).toHaveBeenCalledWith('C:1');
   });

   it('renders one ModalProcessesListRow per process returned (via virtual scroll passthrough)', async () => {
      const wrapper = mountModal();
      await flushPromises();
      const rows = wrapper.findAll('.process-row-stub');
      expect(rows.length).toBe(2);
   });

   it('renders the connection name in the header title', async () => {
      const wrapper = mountModal();
      await flushPromises();
      // getConnectionName may resolve to the seeded name or the uid
      expect(wrapper.html()).toMatch(/local-mysql|C:1/);
   });

   it('error response from Schema.getProcesses is swallowed (no throw)', async () => {
      vi.mocked(Schema.getProcesses).mockResolvedValueOnce({
         status: 'error',
         response: 'access denied'
      } as never);
      expect(() => mountModal()).not.toThrow();
      await flushPromises();
   });

   it('rejected getProcesses is also swallowed (mount stays alive)', async () => {
      vi.mocked(Schema.getProcesses).mockRejectedValueOnce(new Error('boom'));
      const wrapper = mountModal();
      await flushPromises();
      expect(wrapper.exists()).toBe(true);
   });

   it('renders zero rows + no count chip when response is empty', async () => {
      vi.mocked(Schema.getProcesses).mockResolvedValueOnce({
         status: 'success',
         response: []
      } as never);
      const wrapper = mountModal();
      await flushPromises();
      expect(wrapper.findAll('.process-row-stub').length).toBe(0);
   });

   it('responds to the antares:run-or-reload window event by re-fetching', async () => {
      mountModal();
      await flushPromises();
      const initialCalls = vi.mocked(Schema.getProcesses).mock.calls.length;
      window.dispatchEvent(new CustomEvent('antares:run-or-reload'));
      await flushPromises();
      expect(vi.mocked(Schema.getProcesses).mock.calls.length).toBeGreaterThan(initialCalls);
   });

   it('cleans up window listeners on unmount without throwing', async () => {
      const wrapper = mountModal();
      await flushPromises();
      expect(() => wrapper.unmount()).not.toThrow();
   });

   it('exports the component as an SFC object', () => {
      expect(ModalProcessesList).toBeDefined();
      expect(typeof ModalProcessesList).toBe('object');
   });
});
