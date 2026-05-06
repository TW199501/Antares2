/**
 * Tests for ModalProcessesListContext.vue — right-click context menu shown
 * over a row in the "Running Processes" modal. Owns:
 *   - Copy submenu (Cell + Row), gated by props.selectedRow truthiness
 *   - "Kill process" destructive item, also gated by props.selectedRow
 *   - Emits: copy-cell / copy-row / kill-process
 *
 * The component renders ContextMenuContent directly. Stub the menu primitives
 * as passthrough divs (spec §5.A) and inspect rendered text + click flow.
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ModalProcessesListContext from './ModalProcessesListContext.vue';

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
   return mount(ModalProcessesListContext, {
      props: {
         selectedRow: 7,
         selectedCell: { id: 7, command: 'Sleep' },
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

describe('ModalProcessesListContext', () => {
   it('mounts without throwing under default props (selectedRow=7)', () => {
      expect(() => mountCtx()).not.toThrow();
   });

   it('renders Copy submenu trigger + Cell + Row + KillProcess when selectedRow is truthy', () => {
      const wrapper = mountCtx();
      expect(wrapper.html()).toContain('general.copy');
      expect(wrapper.html()).toContain('database.cell');
      expect(wrapper.html()).toContain('database.row');
      expect(wrapper.html()).toContain('database.killProcess');
   });

   it('renders nothing actionable when selectedRow is null/undefined', () => {
      const wrapper = mountCtx({ selectedRow: null });
      // The Copy sub + Separator + Kill are all v-if'd on selectedRow
      expect(wrapper.findAll('.ctx-item-stub').length).toBe(0);
      expect(wrapper.findAll('.ctx-sub-stub').length).toBe(0);
      expect(wrapper.html()).not.toContain('database.killProcess');
   });

   it('emits copy-cell when the Cell item is clicked', async () => {
      const wrapper = mountCtx();
      const items = wrapper.findAll('.ctx-item-stub');
      const cell = items.find(i => i.html().includes('database.cell'));
      expect(cell).toBeTruthy();
      await cell!.trigger('click');
      expect(wrapper.emitted('copy-cell')).toBeTruthy();
   });

   it('emits copy-row when the Row item is clicked', async () => {
      const wrapper = mountCtx();
      const items = wrapper.findAll('.ctx-item-stub');
      const row = items.find(i => i.html().includes('database.row'));
      expect(row).toBeTruthy();
      await row!.trigger('click');
      expect(wrapper.emitted('copy-row')).toBeTruthy();
   });

   it('emits kill-process when the destructive item is clicked', async () => {
      const wrapper = mountCtx();
      const items = wrapper.findAll('.ctx-item-stub');
      const kill = items.find(i => i.html().includes('database.killProcess'));
      expect(kill).toBeTruthy();
      await kill!.trigger('click');
      expect(wrapper.emitted('kill-process')).toBeTruthy();
   });

   it('renders a separator between Copy submenu and Kill item when selectedRow is truthy', () => {
      const wrapper = mountCtx();
      expect(wrapper.findAll('.ctx-sep-stub').length).toBe(1);
   });

   it('still mounts when selectedCell is undefined (component does not read it)', () => {
      const wrapper = mountCtx({ selectedCell: undefined });
      expect(wrapper.html()).toContain('database.killProcess');
   });

   it('exports the component as an SFC object', () => {
      expect(ModalProcessesListContext).toBeDefined();
      expect(typeof ModalProcessesListContext).toBe('object');
   });
});
