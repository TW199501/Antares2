/**
 * Tests for WorkspaceExploreBarMiscFolderContext.vue — the right-click context
 * menu shown over a "misc folder" header in the schema sidebar (e.g. the
 * "Views" / "Triggers" / "Functions" / "Schedulers" folder rows).
 *
 * Each menu item is gated by the selectedMisc string; only one item is
 * rendered at a time (with the special-case of procedure/routine sharing one
 * "create routine" item). On click the SFC emits a single create-* event.
 *
 * Strategy: stub ContextMenuContent + ContextMenuItem as passthrough divs
 * and assert the gate logic + emitted event names per selectedMisc value.
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import WorkspaceExploreBarMiscFolderContext from './WorkspaceExploreBarMiscFolderContext.vue';

const ContextMenuContentStub = { template: '<div class="ctx-content-stub"><slot /></div>' };
const ContextMenuItemStub = {
   name: 'ContextMenuItem',
   emits: ['select'],
   template: '<div class="ctx-item-stub" @click="$emit(\'select\')"><slot /></div>'
};

const mountCtx = (selectedMisc: string) => {
   return mount(WorkspaceExploreBarMiscFolderContext, {
      props: {
         selectedMisc,
         selectedSchema: 'app'
      } as never,
      global: {
         stubs: {
            BaseIcon: true,
            ContextMenuContent: ContextMenuContentStub,
            ContextMenuItem: ContextMenuItemStub
         }
      }
   });
};

describe('WorkspaceExploreBarMiscFolderContext', () => {
   it('mounts without throwing for selectedMisc=view', () => {
      expect(() => mountCtx('view')).not.toThrow();
   });

   it('renders the createNewView item only for selectedMisc=view', () => {
      const wrapper = mountCtx('view');
      const items = wrapper.findAll('.ctx-item-stub');
      expect(items.length).toBe(1);
      expect(wrapper.html()).toContain('database.createNewView');
   });

   it('renders the createNewMaterializedView item for selectedMisc=materializedView', () => {
      const wrapper = mountCtx('materializedView');
      const items = wrapper.findAll('.ctx-item-stub');
      expect(items.length).toBe(1);
      expect(wrapper.html()).toContain('database.createNewMaterializedView');
   });

   it('renders the createNewTrigger item for selectedMisc=trigger', () => {
      const wrapper = mountCtx('trigger');
      expect(wrapper.findAll('.ctx-item-stub').length).toBe(1);
      expect(wrapper.html()).toContain('database.createNewTrigger');
   });

   it('renders the createNewRoutine item for both procedure and routine', () => {
      const procWrapper = mountCtx('procedure');
      const routineWrapper = mountCtx('routine');
      expect(procWrapper.html()).toContain('database.createNewRoutine');
      expect(routineWrapper.html()).toContain('database.createNewRoutine');
   });

   it('renders the createNewFunction item for selectedMisc=function', () => {
      const wrapper = mountCtx('function');
      expect(wrapper.findAll('.ctx-item-stub').length).toBe(1);
      expect(wrapper.html()).toContain('database.createNewFunction');
   });

   it('renders the createNewFunction item for selectedMisc=triggerFunction (postgres)', () => {
      const wrapper = mountCtx('triggerFunction');
      expect(wrapper.findAll('.ctx-item-stub').length).toBe(1);
      expect(wrapper.html()).toContain('database.createNewFunction');
   });

   it('renders the createNewScheduler item for selectedMisc=scheduler', () => {
      const wrapper = mountCtx('scheduler');
      expect(wrapper.findAll('.ctx-item-stub').length).toBe(1);
      expect(wrapper.html()).toContain('database.createNewScheduler');
   });

   it('emits open-create-view-tab when the view item is clicked', async () => {
      const wrapper = mountCtx('view');
      await wrapper.find('.ctx-item-stub').trigger('click');
      expect(wrapper.emitted('open-create-view-tab')).toBeTruthy();
   });

   it('emits open-create-routine-tab when the routine item is clicked under procedure mode', async () => {
      const wrapper = mountCtx('procedure');
      await wrapper.find('.ctx-item-stub').trigger('click');
      expect(wrapper.emitted('open-create-routine-tab')).toBeTruthy();
   });

   it('emits open-create-trigger-function-tab when the triggerFunction item is clicked', async () => {
      const wrapper = mountCtx('triggerFunction');
      await wrapper.find('.ctx-item-stub').trigger('click');
      expect(wrapper.emitted('open-create-trigger-function-tab')).toBeTruthy();
   });

   it('renders zero items for an unknown selectedMisc value', () => {
      const wrapper = mountCtx('unknown-thing');
      expect(wrapper.findAll('.ctx-item-stub').length).toBe(0);
   });

   it('exports the component as an SFC object', () => {
      expect(WorkspaceExploreBarMiscFolderContext).toBeDefined();
      expect(typeof WorkspaceExploreBarMiscFolderContext).toBe('object');
   });
});
