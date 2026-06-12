/**
 * Tests for WorkspaceTabPropsTableContext.vue — the right-click context menu
 * shown over a row inside the table-props "fields" editor. Owns:
 *   - "Create new index" submenu over indexTypes (PRIMARY disabled when one
 *     already exists via hasPrimary computed)
 *   - "Add to index" submenu over existing indexes (item disabled when the
 *     index already references the selected field)
 *   - Duplicate / Delete items
 *   - Emits: add-new-index / add-to-index / duplicate-selected /
 *     delete-selected with field-resolved payloads
 *
 * The component renders ContextMenuContent directly; happy-dom + reka-ui has
 * timing quirks (spec §5.A), so menu primitives are stubbed as passthrough
 * divs. Items still emit @select on click via the stub.
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import WorkspaceTabPropsTableContext from './WorkspaceTabPropsTableContext.vue';

const ContextMenuContentStub = { template: '<div class="ctx-content-stub"><slot /></div>' };
const ContextMenuItemStub = {
   name: 'ContextMenuItem',
   props: { disabled: { type: Boolean, default: false } },
   emits: ['select'],
   template: '<div class="ctx-item-stub" :data-disabled="String(disabled)" @click="!disabled && $emit(\'select\')"><slot /></div>'
};
const ContextMenuSeparatorStub = { template: '<div class="ctx-sep-stub" />' };
const ContextMenuSubStub = { template: '<div class="ctx-sub-stub"><slot /></div>' };
const ContextMenuSubTriggerStub = { template: '<div class="ctx-sub-trigger-stub"><slot /></div>' };
const ContextMenuSubContentStub = { template: '<div class="ctx-sub-content-stub"><slot /></div>' };

const baseIndexTypes = ['PRIMARY', 'UNIQUE', 'INDEX', 'FULLTEXT'];

const baseIndexes = [
   { _antares_id: 'IDX:1', name: 'idx_email', type: 'UNIQUE', fields: ['email'] },
   { _antares_id: 'IDX:2', name: 'pk_users', type: 'PRIMARY', fields: ['id'] }
];

const mountCtx = (
   propOverrides: Record<string, unknown> = {}
) => {
   return mount(WorkspaceTabPropsTableContext, {
      props: {
         indexes: baseIndexes,
         indexTypes: baseIndexTypes,
         selectedField: { name: 'email' },
         ...propOverrides
      } as never,
      global: {
         stubs: {
            BaseIcon: true,
            ContextMenuContent: ContextMenuContentStub,
            ContextMenuItem: ContextMenuItemStub,
            ContextMenuSeparator: ContextMenuSeparatorStub,
            ContextMenuSub: ContextMenuSubStub,
            ContextMenuSubTrigger: ContextMenuSubTriggerStub,
            ContextMenuSubContent: ContextMenuSubContentStub
         }
      }
   });
};

describe('WorkspaceTabPropsTableContext', () => {
   it('mounts without throwing under default props', () => {
      expect(() => mountCtx()).not.toThrow();
   });

   it('renders one item per indexType in the "Create new index" submenu', () => {
      const wrapper = mountCtx();
      // First sub renders 4 indexType items, then "Add to index" renders 2 more,
      // plus Duplicate + Delete = 8 total
      const items = wrapper.findAll('.ctx-item-stub');
      expect(items.length).toBe(baseIndexTypes.length + baseIndexes.length + 2);
      expect(wrapper.html()).toContain('PRIMARY');
      expect(wrapper.html()).toContain('UNIQUE');
   });

   it('disables the PRIMARY entry when an index of type PRIMARY already exists', () => {
      const wrapper = mountCtx();
      const items = wrapper.findAll('.ctx-item-stub');
      const primary = items.find(i => i.html().includes('<span>PRIMARY</span>'));
      expect(primary).toBeTruthy();
      expect(primary!.attributes('data-disabled')).toBe('true');
   });

   it('does NOT disable PRIMARY when no PRIMARY index is present', () => {
      const wrapper = mountCtx({
         indexes: [{ _antares_id: 'IDX:1', name: 'idx_email', type: 'UNIQUE', fields: ['email'] }]
      });
      const items = wrapper.findAll('.ctx-item-stub');
      const primary = items.find(i => i.html().includes('<span>PRIMARY</span>'));
      expect(primary).toBeTruthy();
      expect(primary!.attributes('data-disabled')).toBe('false');
   });

   it('hides the "Add to index" submenu when indexes prop is empty', () => {
      const wrapper = mountCtx({ indexes: [] });
      expect(wrapper.html()).not.toContain('database.addToIndex');
      // Only indexType items + Duplicate + Delete
      const items = wrapper.findAll('.ctx-item-stub');
      expect(items.length).toBe(baseIndexTypes.length + 2);
   });

   it('disables an existing-index item when it already includes the selected field', () => {
      const wrapper = mountCtx({ selectedField: { name: 'email' } });
      const items = wrapper.findAll('.ctx-item-stub');
      const idxEmail = items.find(i => i.html().includes('idx_email'));
      expect(idxEmail).toBeTruthy();
      // idx_email has fields: ['email'] -> disabled
      expect(idxEmail!.attributes('data-disabled')).toBe('true');
      // pk_users' fields: ['id'] -> NOT disabled for selectedField=email
      const pkUsers = items.find(i => i.html().includes('pk_users'));
      expect(pkUsers!.attributes('data-disabled')).toBe('false');
   });

   it('emits add-new-index with {field, index} when an indexType item is clicked', async () => {
      const wrapper = mountCtx({ selectedField: { name: 'name' } });
      const items = wrapper.findAll('.ctx-item-stub');
      // UNIQUE is the second indexType item
      const unique = items.find(i => i.html().includes('<span>UNIQUE</span>'));
      await unique!.trigger('click');
      const evt = wrapper.emitted('add-new-index');
      expect(evt).toBeTruthy();
      expect(evt![0]).toEqual([{ field: 'name', index: 'UNIQUE' }]);
   });

   it('emits add-to-index with {field, index: _antares_id} when an existing-index item is clicked', async () => {
      const wrapper = mountCtx({ selectedField: { name: 'name' } });
      const items = wrapper.findAll('.ctx-item-stub');
      const pkUsers = items.find(i => i.html().includes('pk_users'));
      await pkUsers!.trigger('click');
      const evt = wrapper.emitted('add-to-index');
      expect(evt).toBeTruthy();
      expect(evt![0]).toEqual([{ field: 'name', index: 'IDX:2' }]);
   });

   it('emits duplicate-selected when the Duplicate item is clicked', async () => {
      const wrapper = mountCtx();
      const items = wrapper.findAll('.ctx-item-stub');
      const dup = items.find(i => i.html().includes('general.duplicate'));
      expect(dup).toBeTruthy();
      await dup!.trigger('click');
      expect(wrapper.emitted('duplicate-selected')).toBeTruthy();
   });

   it('emits delete-selected when the Delete item is clicked', async () => {
      const wrapper = mountCtx();
      const items = wrapper.findAll('.ctx-item-stub');
      const del = items.find(i => i.html().includes('database.deleteField'));
      expect(del).toBeTruthy();
      await del!.trigger('click');
      expect(wrapper.emitted('delete-selected')).toBeTruthy();
   });

   it('exports the component as an SFC object', () => {
      expect(WorkspaceTabPropsTableContext).toBeDefined();
      expect(typeof WorkspaceTabPropsTableContext).toBe('object');
   });
});
