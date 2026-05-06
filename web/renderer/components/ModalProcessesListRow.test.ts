/**
 * Tests for ModalProcessesListRow.vue — single row in the Processes table.
 *
 * Renders each column from `row` as a `.td` div, dispatches:
 *   - click → emit('select-row')
 *   - contextmenu → emit('contextmenu', evt, { id, field })
 *   - dblclick on the 'info' column → emit('stop-refresh') + opens an info
 *     modal containing a BaseTextEditor (stubbed here, must expose
 *     updateWindow per spec §5.F).
 *
 * The component renders BaseConfirmModal only when `isInfoModal`. We stub
 * ConfirmModal as a passthrough that re-emits 'hide'.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { describe, expect, it } from 'vitest';

import ModalProcessesListRow from './ModalProcessesListRow.vue';

const baseRow = {
   id: 1,
   user: 'root',
   host: 'localhost',
   db: 'app',
   command: 'Query',
   time: 0,
   state: 'init',
   info: 'SELECT 1'
};

// BaseTextEditor stub exposes updateWindow per spec §5.F (ace-editor avoid).
const TextEditorStub = {
   name: 'BaseTextEditor',
   props: ['modelValue', 'editorClass', 'mode', 'readOnly'],
   methods: {
      updateWindow () {
         /* noop */
      }
   },
   template: '<div class="text-editor-stub" />'
};

const mount = (rowOverrides: Record<string, unknown> = {}) =>
   mountWithPinia(ModalProcessesListRow, {
      props: {
         row: { ...baseRow, ...rowOverrides }
      } as never,
      global: {
         stubs: {
            BaseIcon: true,
            TextEditor: TextEditorStub,
            BaseTextEditor: TextEditorStub,
            ConfirmModal: {
               template:
                  '<div class="confirm-stub"><slot name="header" /><slot name="body" /><button class="hide-btn" @click="$emit(\'hide\')">X</button></div>',
               emits: ['confirm', 'hide']
            }
         }
      }
   });

describe('ModalProcessesListRow', () => {
   it('mounts without throwing and renders one td per row column', () => {
      const wrapper = mount();
      const cells = wrapper.findAll('.td');
      // baseRow has 8 keys
      expect(cells.length).toBe(8);
   });

   it('clicking the row emits select-row', async () => {
      const wrapper = mount();
      await wrapper.find('.tr').trigger('click');
      expect(wrapper.emitted('select-row')).toBeTruthy();
   });

   it('right-click on a cell emits contextmenu with id + field payload', async () => {
      const wrapper = mount();
      const firstCell = wrapper.findAll('.td')[0];
      await firstCell.trigger('contextmenu');
      const ev = wrapper.emitted('contextmenu');
      expect(ev).toBeTruthy();
      // Second arg is the payload object
      expect(ev?.[0]?.[1]).toMatchObject({ id: 1 });
      expect((ev?.[0]?.[1] as { field: string }).field).toBeDefined();
   });

   it('double-clicking a non-info cell does NOT emit stop-refresh', async () => {
      const wrapper = mount();
      const cells = wrapper.findAll('.td');
      // first cell corresponds to 'id'
      await cells[0].find('.cell-content').trigger('dblclick');
      expect(wrapper.emitted('stop-refresh')).toBeFalsy();
   });

   it('double-clicking the info cell emits stop-refresh and opens the info modal', async () => {
      const wrapper = mount();
      // find the cell whose content is the SQL info string
      const allContent = wrapper.findAll('.cell-content');
      const infoCell = allContent.find(c => c.text().includes('SELECT 1'));
      expect(infoCell).toBeDefined();
      await infoCell!.trigger('dblclick');
      expect(wrapper.emitted('stop-refresh')).toBeTruthy();
      // Confirm modal stub now rendered
      expect(wrapper.find('.confirm-stub').exists()).toBe(true);
      expect(wrapper.find('.text-editor-stub').exists()).toBe(true);
   });

   it('hiding the info modal closes it (no longer in DOM)', async () => {
      const wrapper = mount();
      const allContent = wrapper.findAll('.cell-content');
      const infoCell = allContent.find(c => c.text().includes('SELECT 1'));
      await infoCell!.trigger('dblclick');
      expect(wrapper.find('.confirm-stub').exists()).toBe(true);

      await wrapper.find('.hide-btn').trigger('click');
      expect(wrapper.find('.confirm-stub').exists()).toBe(false);
   });

   it('renders is-null marker class when a column value is null', () => {
      const wrapper = mount({ state: null });
      // every cell with null col gets `is-null` in its class list
      const nullCells = wrapper.findAll('.cell-content.is-null');
      expect(nullCells.length).toBeGreaterThan(0);
   });
});
