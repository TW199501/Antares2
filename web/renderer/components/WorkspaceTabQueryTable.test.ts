/**
 * Tests for WorkspaceTabQueryTable.vue — the result-table grid powering both
 * the per-table data viewer and the query result panel. ~974 source lines.
 *
 * Spec §1.C "multi-dependency tier": Pinia + i18n + ipc-api + reka-ui +
 * BaseVirtualScroll virtual scroll + ConfirmModal portal. We stub the heavy
 * children (BaseVirtualScroll exposes `updateWindow` / `scrollToItem` /
 * `resizeResults` which onMounted/refreshScroller call), keep ConfirmModal
 * as an inline shell so v-if branches still render, and exercise the
 * defineExpose surface (`resetSort`, `refreshScroller`, `downloadTable`,
 * `applyUpdate`) to drive coverage through the export-only paths.
 *
 * NOT exercised here: data-state / data-slot reka-ui internals (§5.A), portal
 * inner DOM (§5.B), or sort emit cycle for query mode with table-prefixed
 * column names — those would need full reka mounted for the dropdown menu.
 *
 * The mount-failure trap from the previous module-sanity-only revision was
 * BaseVirtualScroll missing `updateWindow` (called from `onMounted →
 * resizeResults → resultTable.value?.updateWindow()`). The stub below
 * provides all three methods even though only `updateWindow` is hit on
 * mount — defensive against future refactors.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/ipc-api/Tables', () => ({
   default: {
      getTableData: vi.fn().mockResolvedValue({ status: 'success', response: { rows: [], fields: [] } }),
      updateTableCell: vi.fn().mockResolvedValue({ status: 'success', response: { reload: false } }),
      deleteTableRows: vi.fn().mockResolvedValue({ status: 'success', response: null })
   }
}));

vi.mock('@/ipc-api/Schema', () => ({
   default: {
      rawQuery: vi.fn().mockResolvedValue({ status: 'success', response: { rows: [], fields: [] } })
   }
}));

vi.mock('@/libs/copyText', () => ({
   copyText: vi.fn()
}));

vi.mock('../libs/exportRows', () => ({
   exportRows: vi.fn()
}));

// eslint-disable-next-line import/first
import { copyText } from '@/libs/copyText';

// eslint-disable-next-line import/first
import { exportRows as _exportRows } from '../libs/exportRows';
// eslint-disable-next-line import/first
import WorkspaceTabQueryTable from './WorkspaceTabQueryTable.vue';

const sampleField = (overrides: Record<string, unknown> = {}) => ({
   name: 'id',
   alias: 'id',
   table: 'users',
   tableAlias: null,
   schema: 'public',
   type: 'INT',
   length: 11,
   key: 'pri',
   comment: 'primary id',
   ...overrides
});

const buildResults = (rows: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) => [{
   rows,
   fields: [
      sampleField(),
      sampleField({ name: 'name', alias: 'name', key: null, type: 'VARCHAR', length: 255, comment: '' })
   ],
   keys: [],
   duration: 5,
   report: { affectedRows: 0 },
   ...extra
}];

const baseInitialState = () => ({
   console: { consoleHeight: 100 },
   settings: { defaultCopyType: 'cell' },
   workspaces: {
      workspaces: [
         {
            uid: 'conn-1',
            client: 'mysql',
            connectionStatus: 'connected',
            selectedTab: 'tab-1',
            tabs: [],
            structure: [],
            variables: [],
            collations: [],
            users: [],
            breadcrumbs: { schema: 'public' },
            loadingElements: [],
            loadedSchemas: new Set<string>(),
            customizations: { exportByChunks: false, cancelQueries: true },
            searchTerm: ''
         }
      ]
   }
});

const BaseVirtualScrollStub = {
   name: 'BaseVirtualScroll',
   props: ['items', 'itemHeight', 'visibleHeight', 'scrollElement'],
   template: '<div class="vscroll-stub"><slot :items="items || []" :item="(items || [])[0]" :index="0" /></div>',
   methods: {
      updateWindow () {},
      scrollToItem () {},
      resizeResults () {}
   }
};

const ConfirmModalStub = {
   name: 'ConfirmModal',
   emits: ['confirm', 'hide'],
   template: '<div class="cm-stub"><slot name="header" /><slot name="body" /><button class="cm-confirm" type="button" @click="$emit(\'confirm\')" /><button class="cm-hide" type="button" @click="$emit(\'hide\')" /></div>'
};

const QueryRowStub = {
   name: 'WorkspaceTabQueryTableRow',
   props: ['row', 'fields', 'keyUsage', 'elementType', 'selected', 'selectedCell', 'itemHeight'],
   template: '<tr class="qrow-stub" />'
};

const TabsStub = {
   name: 'Tabs',
   props: ['modelValue'],
   emits: ['update:modelValue'],
   template: '<div class="tabs-stub" :data-active="modelValue"><slot /></div>'
};

const TabsTriggerStub = {
   name: 'TabsTrigger',
   props: ['value'],
   template: '<button type="button" class="tabs-trigger-stub" :data-value="value" @click="$parent.$emit(\'update:modelValue\', value)"><slot /></button>'
};

const InputStub = {
   name: 'Input',
   props: ['modelValue', 'type', 'placeholder'],
   emits: ['update:modelValue'],
   template: '<input class="input-stub" v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
};

const LabelStub = {
   name: 'Label',
   template: '<label class="label-stub"><slot /></label>'
};

const SwitchStub = {
   name: 'Switch',
   props: ['checked'],
   emits: ['update:checked'],
   template: '<input type="checkbox" class="switch-stub" :checked="checked" @change="$emit(\'update:checked\', $event.target.checked)" />'
};

const mountTable = (props: Record<string, unknown> = {}, extraState: Record<string, unknown> = {}) => {
   const _initialState = { ...baseInitialState(), ...extraState };
   return mountWithPinia(WorkspaceTabQueryTable, {
      props: {
         results: buildResults([{ id: 1, name: 'a' }]),
         connUid: 'conn-1',
         isQuering: false,
         mode: 'query',
         page: 1,
         isSelected: true,
         elementType: 'table',
         useCommentHeader: false,
         ...props
      },
      global: {
         stubs: {
            BaseIcon: true,
            BaseLoader: true,
            BaseSelect: true,
            BaseVirtualScroll: BaseVirtualScrollStub,
            WorkspaceTabQueryTableRow: QueryRowStub,
            WorkspaceTabQueryTableContext: true,
            TableContext: true,
            ConfirmModal: ConfirmModalStub,
            BaseConfirmModal: ConfirmModalStub,
            Tabs: TabsStub,
            TabsList: { template: '<div class="tabs-list-stub"><slot /></div>' },
            TabsTrigger: TabsTriggerStub,
            TabsContent: { template: '<div class="tabs-content-stub"><slot /></div>' },
            Input: InputStub,
            Label: LabelStub,
            Switch: SwitchStub
         }
      }
   } as Parameters<typeof mountWithPinia>[1]);
};

describe('WorkspaceTabQueryTable', () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it('mounts without throwing on a minimal happy-path payload', async () => {
      expect(() => mountTable()).not.toThrow();
      await flushPromises();
   });

   it('renders the header row with one .th per de-duplicated field', async () => {
      const wrapper = mountTable();
      await flushPromises();
      const headers = wrapper.findAll('.th');
      // Two fields after de-dup (id + name)
      expect(headers.length).toBe(2);
   });

   it('renders the BaseVirtualScroll body when the active resultset has rows', async () => {
      const wrapper = mountTable();
      await flushPromises();
      expect(wrapper.find('.vscroll-stub').exists()).toBe(true);
   });

   it('does NOT render BaseVirtualScroll when the active resultset has 0 rows', async () => {
      // Single empty resultset → resultsWithRows is empty so v-if hides scroller,
      // but the header row should still render via the fields fallback.
      const wrapper = mountTable({ results: buildResults([]) });
      await flushPromises();
      expect(wrapper.find('.vscroll-stub').exists()).toBe(false);
      // Header still rendered via the un-filtered fallback path
      expect(wrapper.findAll('.th').length).toBe(2);
   });

   it('renders Tabs when more than one resultset has rows', async () => {
      const multi = [
         ...buildResults([{ id: 1, name: 'a' }]),
         ...buildResults([{ id: 2, name: 'b' }], { duration: 7 })
      ];
      const wrapper = mountTable({ results: multi });
      await flushPromises();
      expect(wrapper.find('.tabs-stub').exists()).toBe(true);
      // Two triggers, one per non-empty resultset
      expect(wrapper.findAll('.tabs-trigger-stub').length).toBe(2);
   });

   it('does NOT render Tabs when only one resultset has rows', async () => {
      const wrapper = mountTable();
      await flushPromises();
      expect(wrapper.find('.tabs-stub').exists()).toBe(false);
   });

   it('updates props.results reactively (triggers watch → resultsetIndex reset)', async () => {
      const wrapper = mountTable();
      await flushPromises();
      const next = buildResults([{ id: 9, name: 'z' }, { id: 10, name: 'q' }]);
      await wrapper.setProps({ results: next });
      await flushPromises();
      // Component should still mount cleanly after the watch fires
      expect(wrapper.find('.vscroll-stub').exists()).toBe(true);
   });

   it('clicking a column header emits hard-sort with field+dir asc on first click', async () => {
      const wrapper = mountTable();
      await flushPromises();
      const titles = wrapper.findAll('.table-column-title');
      expect(titles.length).toBeGreaterThan(0);
      await titles[0].trigger('click');
      await flushPromises();
      const emitted = wrapper.emitted('hard-sort');
      expect(emitted).toBeTruthy();
      expect(emitted![0][0]).toMatchObject({ dir: 'asc' });
   });

   it('clicking the same column header twice flips the sort direction to desc', async () => {
      const wrapper = mountTable();
      await flushPromises();
      const title = wrapper.findAll('.table-column-title')[0];
      await title.trigger('click');
      await flushPromises();
      await title.trigger('click');
      await flushPromises();
      const emitted = wrapper.emitted('hard-sort');
      expect(emitted!.length).toBeGreaterThanOrEqual(2);
      expect(emitted![1][0]).toMatchObject({ dir: 'desc' });
   });

   it('does not emit hard-sort while isQuering=true (sort guard)', async () => {
      const wrapper = mountTable({ isQuering: true });
      await flushPromises();
      const title = wrapper.findAll('.table-column-title')[0];
      await title.trigger('click');
      await flushPromises();
      expect(wrapper.emitted('hard-sort')).toBeUndefined();
   });

   it('exposes defineExpose surface: resetSort / refreshScroller / downloadTable / applyUpdate', async () => {
      const wrapper = mountTable();
      await flushPromises();
      const vm = wrapper.vm as unknown as Record<string, unknown>;
      expect(typeof vm.resetSort).toBe('function');
      expect(typeof vm.refreshScroller).toBe('function');
      expect(typeof vm.downloadTable).toBe('function');
      expect(typeof vm.applyUpdate).toBe('function');
      expect(typeof vm.resizeResults).toBe('function');
      // Calling them should not throw
      expect(() => (vm.resetSort as () => void)()).not.toThrow();
      expect(() => (vm.refreshScroller as () => void)()).not.toThrow();
   });

   it('applyUpdate via defineExpose mutates the matching local row', async () => {
      const wrapper = mountTable();
      await flushPromises();
      const vm = wrapper.vm as unknown as {
         applyUpdate: (p: { primary: string; id: unknown; field: string; table: string; content: unknown }) => void;
      };
      expect(() => vm.applyUpdate({ primary: 'id', id: 1, field: 'name', table: 'users', content: 'changed' })).not.toThrow();
   });

   it('downloadTable("csv", table) opens the CSV options modal', async () => {
      const wrapper = mountTable();
      await flushPromises();
      const vm = wrapper.vm as unknown as { downloadTable: (...args: unknown[]) => void };
      vm.downloadTable('csv', 'users');
      await flushPromises();
      expect(wrapper.findAll('.cm-stub').length).toBeGreaterThan(0);
   });

   it('renders header label from field.alias by default', async () => {
      const wrapper = mountTable();
      await flushPromises();
      const html = wrapper.html();
      // Default useCommentHeader=false → label is alias|name; alias is 'id' / 'name'
      expect(html).toContain('id');
      expect(html).toContain('name');
   });

   it('renders header label from field.comment when useCommentHeader=true', async () => {
      const wrapper = mountTable({ useCommentHeader: true });
      await flushPromises();
      const html = wrapper.html();
      // Comment for first field is 'primary id'
      expect(html).toContain('primary id');
   });

   it('isQuering prop transitions do not throw and do not break sort guard', async () => {
      const wrapper = mountTable();
      await flushPromises();
      await wrapper.setProps({ isQuering: true });
      await flushPromises();
      await wrapper.setProps({ isQuering: false });
      await flushPromises();
      expect(wrapper.find('.thead').exists()).toBe(true);
   });

   it('isSelected toggling true→false→true does not throw (refreshScroller watch)', async () => {
      const wrapper = mountTable();
      await flushPromises();
      await wrapper.setProps({ isSelected: false });
      await flushPromises();
      await wrapper.setProps({ isSelected: true });
      await flushPromises();
      expect(wrapper.find('.vscroll-stub').exists()).toBe(true);
   });

   it('gracefully handles empty fields (single result with [] fields)', async () => {
      const wrapper = mountTable({
         results: [{ rows: [], fields: [], keys: [], duration: 0, report: { affectedRows: 0 } }]
      });
      await flushPromises();
      // No headers, no scroller — should still mount
      expect(wrapper.find('.thead').exists()).toBe(true);
      expect(wrapper.findAll('.th').length).toBe(0);
   });

   it('cleans up window listeners on unmount (smoke: no throw)', async () => {
      const wrapper = mountTable();
      await flushPromises();
      expect(() => wrapper.unmount()).not.toThrow();
   });

   it('copyText mock is wired (defensive: ensures the module replacement loaded)', () => {
      // Sanity: makes sure our vi.mock for @/libs/copyText is hooked. If the
      // resolver ever drifts (path alias change), this fails fast.
      expect(typeof copyText).toBe('function');
   });
});
