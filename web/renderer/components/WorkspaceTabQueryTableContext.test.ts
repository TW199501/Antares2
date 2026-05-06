/**
 * Tests for WorkspaceTabQueryTableContext.vue — the right-click context menu
 * shown over a result-set cell. Owns:
 *   - "Copy" submenu with Cell (only when 1 row selected) + Row variants
 *     (HTML / JSON / CSV / PHP / SQL INSERT)
 *   - Duplicate row (only when 1 row selected + editable + mode === 'table')
 *   - Faker submenu (gated by selectedCell.type → fakerGroup) with N items
 *     per group → emits 'fill-cell' with the resolved type
 *   - "Set NULL" + Delete (destructive); both gated by selectedCell.isEditable
 *
 * The component renders ContextMenuContent directly. We stub all menu
 * primitives as passthrough divs and inspect rendered text + click flow.
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import WorkspaceTabQueryTableContext from './WorkspaceTabQueryTableContext.vue';

const ContextMenuContentStub = { template: '<div class="ctx-content-stub"><slot /></div>' };
const ContextMenuItemStub = {
   name: 'ContextMenuItem',
   emits: ['select'],
   template: '<div class="ctx-item-stub" @click="$emit(\'select\')"><slot /></div>'
};
const ContextMenuSeparatorStub = { template: '<div class="ctx-sep-stub" />' };
const ContextMenuSubStub = { template: '<div class="ctx-sub-stub"><slot /></div>' };
const ContextMenuSubTriggerStub = { template: '<div class="ctx-sub-trigger-stub"><slot /></div>' };
const ContextMenuSubContentStub = { template: '<div class="ctx-sub-content-stub"><slot /></div>' };

const mountCtx = (
   propOverrides: Record<string, unknown> = {}
) => {
   return mount(WorkspaceTabQueryTableContext, {
      props: {
         selectedRows: [{ _antares_id: 'r1' }],
         selectedCell: { type: 'VARCHAR', isEditable: true },
         mode: 'table',
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

describe('WorkspaceTabQueryTableContext', () => {
   it('mounts without throwing under default props (1-row VARCHAR cell, editable, table mode)', () => {
      expect(() => mountCtx()).not.toThrow();
   });

   it('renders the Copy submenu trigger always (regardless of editable)', () => {
      const wrapper = mountCtx({
         selectedCell: { type: 'VARCHAR', isEditable: false }
      });
      expect(wrapper.html()).toContain('general.copy');
   });

   it('renders the cell-copy item when exactly 1 row is selected', () => {
      const wrapper = mountCtx();
      // database.cell maps to "Cell" in the i18n identity mock
      expect(wrapper.html()).toContain('database.cell');
   });

   it('omits the cell-copy item when more than 1 row is selected', () => {
      const wrapper = mountCtx({
         selectedRows: [{ _antares_id: 'r1' }, { _antares_id: 'r2' }]
      });
      expect(wrapper.html()).not.toContain('database.cell');
      // Row copy variants are still there
      expect(wrapper.html()).toContain('database.row');
   });

   it('renders Duplicate item when 1-row + editable + mode=table', () => {
      const wrapper = mountCtx();
      expect(wrapper.html()).toContain('general.duplicate');
   });

   it('omits Duplicate when mode === "query"', () => {
      const wrapper = mountCtx({ mode: 'query' });
      expect(wrapper.html()).not.toContain('general.duplicate');
   });

   it('omits Duplicate when selectedCell.isEditable is false', () => {
      const wrapper = mountCtx({
         selectedCell: { type: 'VARCHAR', isEditable: false }
      });
      expect(wrapper.html()).not.toContain('general.duplicate');
   });

   it('renders Set NULL + Delete only when isEditable is true', () => {
      const editable = mountCtx();
      expect(editable.html()).toContain('database.setNull');
      expect(editable.html()).toContain('database.deleteRows');

      const readonly = mountCtx({ selectedCell: { type: 'VARCHAR', isEditable: false } });
      expect(readonly.html()).not.toContain('database.setNull');
      expect(readonly.html()).not.toContain('database.deleteRows');
   });

   it('renders the Faker fillCell submenu for a string type (TEXT/VARCHAR)', () => {
      const wrapper = mountCtx({
         selectedCell: { type: 'VARCHAR', isEditable: true }
      });
      expect(wrapper.html()).toContain('database.fillCell');
      // String group has 11 faker methods incl. faker.firstName
      expect(wrapper.html()).toContain('faker.firstName');
      expect(wrapper.html()).toContain('faker.exampleEmail');
   });

   it('renders the Faker submenu with number-only methods for INT type', () => {
      const wrapper = mountCtx({
         selectedCell: { type: 'INT', isEditable: true }
      });
      expect(wrapper.html()).toContain('database.fillCell');
      // number group → faker.number only, NOT faker.firstName
      expect(wrapper.html()).toContain('faker.number');
      expect(wrapper.html()).not.toContain('faker.firstName');
   });

   it('omits the Faker submenu entirely for an unknown type (fakerGroup === false)', () => {
      const wrapper = mountCtx({
         selectedCell: { type: 'GEOMETRY', isEditable: true }
      });
      expect(wrapper.html()).not.toContain('database.fillCell');
   });

   it('emits copy-cell when the cell-copy item is clicked', async () => {
      const wrapper = mountCtx();
      const items = wrapper.findAll('.ctx-item-stub');
      // The first item inside the Copy submenu should be the Cell variant
      // when selectedRows.length === 1.
      const cellItem = items.find(i => i.html().includes('database.cell'));
      expect(cellItem).toBeTruthy();
      await cellItem!.trigger('click');
      expect(wrapper.emitted('copy-cell')).toBeTruthy();
   });

   it('emits copy-row with the right format for each row-copy variant', async () => {
      const wrapper = mountCtx();
      const items = wrapper.findAll('.ctx-item-stub');
      // The 5 row-copy items follow the Cell item — match by text "(JSON)" / "(CSV)" / etc.
      const jsonItem = items.find(i => i.html().includes('(JSON)'));
      expect(jsonItem).toBeTruthy();
      await jsonItem!.trigger('click');
      const evt = wrapper.emitted('copy-row');
      expect(evt).toBeTruthy();
      expect(evt![0]).toEqual(['json']);
   });

   it('emits set-null when the Set NULL item is clicked', async () => {
      const wrapper = mountCtx();
      const items = wrapper.findAll('.ctx-item-stub');
      const nullItem = items.find(i => i.html().includes('database.setNull'));
      expect(nullItem).toBeTruthy();
      await nullItem!.trigger('click');
      expect(wrapper.emitted('set-null')).toBeTruthy();
   });

   it('emits show-delete-modal when the Delete item is clicked', async () => {
      const wrapper = mountCtx();
      const items = wrapper.findAll('.ctx-item-stub');
      const delItem = items.find(i => i.html().includes('database.deleteRows'));
      expect(delItem).toBeTruthy();
      await delItem!.trigger('click');
      expect(wrapper.emitted('show-delete-modal')).toBeTruthy();
   });

   it('emits duplicate-row when the Duplicate item is clicked', async () => {
      const wrapper = mountCtx();
      const items = wrapper.findAll('.ctx-item-stub');
      const dupItem = items.find(i => i.html().includes('general.duplicate'));
      expect(dupItem).toBeTruthy();
      await dupItem!.trigger('click');
      expect(wrapper.emitted('duplicate-row')).toBeTruthy();
   });

   it('emits fill-cell with merged {name, group, type} payload when a faker method is clicked', async () => {
      const wrapper = mountCtx({
         selectedCell: { type: 'VARCHAR', isEditable: true }
      });
      const items = wrapper.findAll('.ctx-item-stub');
      const firstNameItem = items.find(i => i.html().includes('faker.firstName'));
      expect(firstNameItem).toBeTruthy();
      await firstNameItem!.trigger('click');
      const evt = wrapper.emitted('fill-cell');
      expect(evt).toBeTruthy();
      // Payload is the merged faker method + fakerGroup type
      expect(evt![0][0]).toMatchObject({
         name: 'firstName',
         group: 'name',
         type: 'string'
      });
   });

   it('exports the component as an SFC object', () => {
      expect(WorkspaceTabQueryTableContext).toBeDefined();
      expect(typeof WorkspaceTabQueryTableContext).toBe('object');
   });
});
