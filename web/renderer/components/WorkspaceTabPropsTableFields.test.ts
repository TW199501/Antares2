/**
 * Tests for WorkspaceTabPropsTableFields.vue — the column-grid container
 * for the per-table "Properties" tab. Owns the header row + a vuedraggable
 * `tbody` of WorkspaceTabPropsTableRow children, plus a TableContext popup.
 *
 * The component is mostly composition + small handlers:
 *   - getIndexes(field)   flatten props.indexes into per-row index entries
 *   - getForeigns(field)  build "ref.refField" labels per row
 *   - moveFieldUp/Down    in-place swap on props.fields
 *   - contextMenu         opens TableContext at the right row
 *   - duplicateField / removeField / removeFieldById  emit upward
 *   - resizeResults       window-resize handler that subtracts footer +
 *                         consoleHeight to size the inner scroll area
 *
 * Strategy:
 *   - Stub vuedraggable Draggable as a passthrough that renders #item per
 *     entry of `:list` so TableRow children appear in the DOM.
 *   - Stub TableRow + TableContext as classed shells; assertions probe the
 *     stub markup (count + emitted events bridging back up).
 *   - Seed workspaces store with a workspace that has dataTypes +
 *     customizations so the computed props the SFC reads don't throw.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import WorkspaceTabPropsTableFields from './WorkspaceTabPropsTableFields.vue';

const baseCustomizations = {
   autoIncrement: true,
   nullable: true,
   nullablePrimary: false,
   comment: true,
   sortableFields: true,
   onUpdate: true
};

const baseDataTypes = [
   {
      group: 'integer',
      types: [
         { name: 'INT', length: true }
      ]
   }
];

const buildWorkspace = (overrides: Record<string, unknown> = {}) => ({
   uid: 'C:1',
   client: 'mysql',
   database: 'app',
   connectionStatus: 'connected',
   tabs: [],
   selectedTab: null,
   structure: [],
   breadcrumbs: { schema: 'app', table: null },
   loadedSchemas: new Set(),
   customizations: baseCustomizations,
   dataTypes: baseDataTypes,
   indexTypes: ['PRIMARY', 'INDEX', 'UNIQUE'],
   variables: [],
   engines: [],
   collations: [],
   ...overrides
});

const buildField = (over: Record<string, unknown> = {}) => ({
   _antares_id: 'F:1',
   order: 1,
   name: 'id',
   type: 'INT',
   numLength: 11,
   numPrecision: null,
   numScale: null,
   charLength: null,
   datePrecision: null,
   enumValues: '',
   nullable: false,
   autoIncrement: true,
   key: 'pri',
   default: null,
   onUpdate: '',
   comment: '',
   collation: null,
   unsigned: false,
   zerofill: false,
   length: null,
   ...over
});

const TableRowStub = {
   name: 'TableRow',
   inheritAttrs: false,
   props: {
      row: { type: Object, default: () => ({}) },
      indexes: { type: Array, default: () => [] },
      foreigns: { type: Array, default: () => [] },
      dataTypes: { type: Array, default: () => [] },
      customizations: { type: Object, default: () => ({}) }
   },
   emits: ['contextmenu', 'rename-field', 'move-up', 'move-down', 'remove-field-row', 'edit-field'],
   template: `
      <div class="row-stub" :data-id="row._antares_id" :data-foreigns="foreigns.length" :data-indexes="indexes.length">
         <button class="row-ctx" type="button" @click="$emit('contextmenu', $event, row._antares_id)" />
         <button class="row-up" type="button" @click="$emit('move-up', row._antares_id)" />
         <button class="row-down" type="button" @click="$emit('move-down', row._antares_id)" />
         <button class="row-remove" type="button" @click="$emit('remove-field-row', row._antares_id)" />
         <button class="row-edit" type="button" @click="$emit('edit-field', row._antares_id)" />
      </div>
   `
};

// vuedraggable Draggable passthrough: render #item slot for each entry in
// :list so child rows actually appear in the DOM under happy-dom.
const DraggableStub = {
   name: 'Draggable',
   props: { list: { type: Array, default: () => [] } },
   template: `
      <div class="draggable-stub">
         <template v-for="(element, index) in list" :key="element._antares_id || index">
            <slot name="item" :element="element" :index="index" />
         </template>
      </div>
   `
};

const TableContextStub = {
   name: 'TableContext',
   inheritAttrs: false,
   props: {
      contextEvent: { type: Object, default: null },
      selectedField: { type: Object, default: null },
      indexTypes: { type: Array, default: () => [] },
      indexes: { type: Array, default: () => [] }
   },
   emits: ['delete-selected', 'duplicate-selected', 'close-context', 'add-new-index', 'add-to-index'],
   template: '<div class="table-context-stub" :data-selected="selectedField ? selectedField._antares_id : \'\'" />'
};

const mountFields = (
   propOverrides: Record<string, unknown> = {},
   workspaceOverrides: Record<string, unknown> = {}
) => {
   const workspace = buildWorkspace(workspaceOverrides);
   return mountWithPinia(WorkspaceTabPropsTableFields, {
      props: {
         fields: [buildField()],
         indexes: [{ name: 'PRIMARY', type: 'PRIMARY', fields: ['id'] }],
         foreigns: [],
         indexTypes: ['PRIMARY', 'INDEX', 'UNIQUE'],
         tabUid: 'TAB:1',
         connUid: 'C:1',
         table: 'orders',
         schema: 'app',
         mode: 'table',
         ...propOverrides
      } as never,
      initialState: {
         workspaces: {
            workspaces: [workspace],
            selectedWorkspace: 'C:1'
         },
         console: { isConsoleOpen: false, consoleHeight: 0 }
      },
      stubActions: true,
      global: {
         stubs: {
            BaseIcon: true,
            TableRow: TableRowStub,
            TableContext: TableContextStub,
            Draggable: DraggableStub
         }
      }
   });
};

afterEach(() => {
   vi.clearAllMocks();
});

describe('WorkspaceTabPropsTableFields', () => {
   it('mounts without throwing on a default 1-field setup', async () => {
      expect(() => mountFields()).not.toThrow();
      await flushPromises();
   });

   it('renders one TableRow stub per field via Draggable slot', async () => {
      const wrapper = mountFields({
         fields: [buildField(), buildField({ _antares_id: 'F:2', name: 'email' })]
      });
      await flushPromises();
      const rows = wrapper.findAll('.row-stub');
      expect(rows.length).toBe(2);
      expect(rows[0].attributes('data-id')).toBe('F:1');
      expect(rows[1].attributes('data-id')).toBe('F:2');
   });

   it('renders the table header titles for fixed columns', async () => {
      const wrapper = mountFields();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain('database.order');
      expect(html).toContain('database.fieldName');
      expect(html).toContain('database.type');
      expect(html).toContain('database.primaryKey');
      expect(html).toContain('database.length');
      expect(html).toContain('database.default');
      expect(html).toContain('general.actions');
   });

   it('omits the auto-increment header when customizations.autoIncrement is false', async () => {
      const wrapper = mountFields({}, {
         customizations: { ...baseCustomizations, autoIncrement: false }
      });
      await flushPromises();
      expect(wrapper.html()).not.toContain('database.autoIncrement');
   });

   it('omits the nullable + comment headers when both customizations are off', async () => {
      const wrapper = mountFields({}, {
         customizations: { ...baseCustomizations, nullable: false, comment: false }
      });
      await flushPromises();
      const html = wrapper.html();
      expect(html).not.toContain('database.allowNull');
      expect(html).not.toContain('database.comment');
   });

   it('passes computed indexes to the matching row only (PRIMARY for "id")', async () => {
      const wrapper = mountFields({
         fields: [buildField(), buildField({ _antares_id: 'F:2', name: 'email' })],
         indexes: [{ name: 'PRIMARY', type: 'PRIMARY', fields: ['id'] }]
      });
      await flushPromises();
      const rows = wrapper.findAll('.row-stub');
      // First row "id" → 1 index (PRIMARY); second row "email" → 0
      expect(rows[0].attributes('data-indexes')).toBe('1');
      expect(rows[1].attributes('data-indexes')).toBe('0');
   });

   it('passes formatted FK labels to the row for fields with a matching foreign', async () => {
      const wrapper = mountFields({
         foreigns: [{ field: 'id', refTable: 'users', refField: 'id' }]
      });
      await flushPromises();
      const rows = wrapper.findAll('.row-stub');
      expect(rows[0].attributes('data-foreigns')).toBe('1');
   });

   it('forwards remove-field-row from a row up as a remove-field emit', async () => {
      const wrapper = mountFields();
      await flushPromises();
      await wrapper.find('.row-remove').trigger('click');
      const evt = wrapper.emitted('remove-field');
      expect(evt).toBeTruthy();
      expect(evt![0]).toEqual(['F:1']);
   });

   it('forwards edit-field from a row up unchanged', async () => {
      const wrapper = mountFields();
      await flushPromises();
      await wrapper.find('.row-edit').trigger('click');
      const evt = wrapper.emitted('edit-field');
      expect(evt).toBeTruthy();
      expect(evt![0]).toEqual(['F:1']);
   });

   it('opens the TableContext popup on row contextmenu and stamps selectedField', async () => {
      const wrapper = mountFields({
         fields: [buildField(), buildField({ _antares_id: 'F:2', name: 'email' })]
      });
      await flushPromises();
      // Initially no context
      expect(wrapper.find('.table-context-stub').exists()).toBe(false);
      const rows = wrapper.findAll('.row-stub');
      await rows[1].find('.row-ctx').trigger('click');
      await flushPromises();
      const ctx = wrapper.find('.table-context-stub');
      expect(ctx.exists()).toBe(true);
      expect(ctx.attributes('data-selected')).toBe('F:2');
   });

   it('moveFieldUp swaps adjacent rows in the parent fields array', async () => {
      const fields = [
         buildField({ _antares_id: 'F:1', name: 'id' }),
         buildField({ _antares_id: 'F:2', name: 'email' })
      ];
      const wrapper = mountFields({ fields });
      await flushPromises();
      // Click move-up on the second row (F:2) → expect F:2 to become first
      const secondRowUp = wrapper.findAll('.row-up')[1];
      await secondRowUp.trigger('click');
      await flushPromises();
      // The component mutates the props array in-place. Re-render via setProps
      // is not needed because we share the array reference.
      expect(fields[0]._antares_id).toBe('F:2');
      expect(fields[1]._antares_id).toBe('F:1');
   });

   it('moveFieldUp is a no-op for the first row (idx <= 0 guard)', async () => {
      const fields = [
         buildField({ _antares_id: 'F:1', name: 'id' }),
         buildField({ _antares_id: 'F:2', name: 'email' })
      ];
      const wrapper = mountFields({ fields });
      await flushPromises();
      await wrapper.findAll('.row-up')[0].trigger('click');
      expect(fields[0]._antares_id).toBe('F:1');
      expect(fields[1]._antares_id).toBe('F:2');
   });

   it('moveFieldDown swaps with next row when not last', async () => {
      const fields = [
         buildField({ _antares_id: 'F:1', name: 'id' }),
         buildField({ _antares_id: 'F:2', name: 'email' })
      ];
      const wrapper = mountFields({ fields });
      await flushPromises();
      await wrapper.findAll('.row-down')[0].trigger('click');
      expect(fields[0]._antares_id).toBe('F:2');
      expect(fields[1]._antares_id).toBe('F:1');
   });

   it('moveFieldDown is a no-op for the last row (idx >= length-1 guard)', async () => {
      const fields = [
         buildField({ _antares_id: 'F:1', name: 'id' }),
         buildField({ _antares_id: 'F:2', name: 'email' })
      ];
      const wrapper = mountFields({ fields });
      await flushPromises();
      await wrapper.findAll('.row-down')[1].trigger('click');
      expect(fields[0]._antares_id).toBe('F:1');
      expect(fields[1]._antares_id).toBe('F:2');
   });

   it('cleans up the resize listener on unmount (smoke)', async () => {
      const wrapper = mountFields();
      await flushPromises();
      expect(() => wrapper.unmount()).not.toThrow();
   });
});
