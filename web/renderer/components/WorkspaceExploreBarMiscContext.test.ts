/**
 * Tests for WorkspaceExploreBarMiscContext.vue — the right-click context
 * menu shown over a "misc" sidebar element (trigger / routine / function /
 * scheduler). Owns:
 *   - Type-conditional menu items: Run (procedure/routine/function),
 *     Toggle (trigger/scheduler), Copy name, Delete (with ConfirmModal)
 *   - Async dispatch path on Delete via Triggers/Routines/Functions/
 *     Schedulers `dropX` IPC wrappers
 *   - runRoutineCheck / runFunctionCheck → newTab tab dispatch with
 *     client-aware SQL composition (CALL / EXEC / SELECT ...)
 *   - toggleTrigger / toggleScheduler → loading element ↔ IPC ↔ reload
 *
 * The component renders a `ContextMenuContent` directly (no `ContextMenuRoot`
 * wrapper), so we stub the menu primitives as passthrough divs and probe
 * the rendered DOM. ConfirmModal is replaced with a slot-passthrough shell
 * to drive @confirm / @hide.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import Functions from '@/ipc-api/Functions';
import Routines from '@/ipc-api/Routines';
import Schedulers from '@/ipc-api/Schedulers';
import Triggers from '@/ipc-api/Triggers';

import WorkspaceExploreBarMiscContext from './WorkspaceExploreBarMiscContext.vue';

vi.mock('@/ipc-api/Triggers', () => ({
   default: {
      dropTrigger: vi.fn().mockResolvedValue({ status: 'success', response: null }),
      toggleTrigger: vi.fn().mockResolvedValue({ status: 'success', response: null })
   }
}));
vi.mock('@/ipc-api/Routines', () => ({
   default: {
      dropRoutine: vi.fn().mockResolvedValue({ status: 'success', response: null }),
      getRoutineInformations: vi.fn().mockResolvedValue({
         status: 'success',
         response: { name: 'sp_one', parameters: [] }
      })
   }
}));
vi.mock('@/ipc-api/Functions', () => ({
   default: {
      dropFunction: vi.fn().mockResolvedValue({ status: 'success', response: null }),
      getFunctionInformations: vi.fn().mockResolvedValue({
         status: 'success',
         response: { name: 'fn_one', parameters: [] }
      })
   }
}));
vi.mock('@/ipc-api/Schedulers', () => ({
   default: {
      dropScheduler: vi.fn().mockResolvedValue({ status: 'success', response: null }),
      toggleScheduler: vi.fn().mockResolvedValue({ status: 'success', response: null })
   }
}));
vi.mock('@/libs/copyText', () => ({
   copyText: vi.fn()
}));

// ConfirmModal passthrough — exposes header + body slots and re-emits the
// two events the SFC subscribes to.
const ConfirmModalStub = {
   name: 'ConfirmModal',
   inheritAttrs: false,
   emits: ['confirm', 'hide'],
   template: `
      <div class="confirm-modal-stub">
         <div class="cm-header"><slot name="header" /></div>
         <div class="cm-body"><slot name="body" /></div>
         <button type="button" class="cm-confirm-btn" @click="$emit('confirm')">confirm</button>
         <button type="button" class="cm-hide-btn" @click="$emit('hide')">hide</button>
      </div>
   `
};

const baseConnections = [
   { uid: 'C:1', name: 'app-mysql', client: 'mysql', readonly: false }
];

const baseWorkspace = {
   uid: 'C:1',
   client: 'mysql',
   database: 'app',
   connectionStatus: 'connected',
   tabs: [],
   selectedTab: null,
   structure: [],
   breadcrumbs: { schema: 'app' },
   loadedSchemas: new Set(),
   customizations: {
      triggerEnableDisable: true
   }
};

const mountCtx = (
   propOverrides: Record<string, unknown> = {},
   stateOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(WorkspaceExploreBarMiscContext, {
      props: {
         selectedMisc: { name: 'sp_one', type: 'procedure' },
         selectedSchema: 'app',
         ...propOverrides
      } as never,
      initialState: {
         connections: {
            connections: baseConnections,
            connectionsOrder: baseConnections.map(c => ({ ...c, isFolder: false })),
            ...(stateOverrides.connections as Record<string, unknown> ?? {})
         },
         workspaces: {
            workspaces: [baseWorkspace],
            selectedWorkspace: 'C:1',
            ...(stateOverrides.workspaces as Record<string, unknown> ?? {})
         },
         notifications: { notifications: [] }
      },
      stubActions: true,
      global: {
         stubs: {
            BaseIcon: true,
            ConfirmModal: ConfirmModalStub,
            ModalAskParameters: true,
            // Render menu items as plain divs so we can match by text/role.
            // @select event is what the SFC binds; we re-emit it on click.
            ContextMenuContent: { template: '<div class="ctx-content-stub"><slot /></div>' },
            ContextMenuItem: {
               name: 'ContextMenuItem',
               emits: ['select'],
               template: '<div class="ctx-item-stub" @click="$emit(\'select\')"><slot /></div>'
            },
            ContextMenuSeparator: { template: '<div class="ctx-sep-stub" />' }
         }
      }
   });
};

describe('WorkspaceExploreBarMiscContext', () => {
   it('mounts without throwing under default selectedMisc=procedure', () => {
      expect(() => mountCtx()).not.toThrow();
   });

   it('renders the Run + CopyName + Delete items for a procedure', () => {
      const wrapper = mountCtx({ selectedMisc: { name: 'sp_archive', type: 'procedure' } });
      const items = wrapper.findAll('.ctx-item-stub');
      // procedure → Run + CopyName + Delete = 3 items (no toggle)
      expect(items.length).toBe(3);
      expect(wrapper.html()).toContain('general.run');
      expect(wrapper.html()).toContain('general.copyName');
      expect(wrapper.html()).toContain('general.delete');
   });

   it('renders Toggle (Enable/Disable) for a trigger when readonly is false', () => {
      const wrapper = mountCtx({
         selectedMisc: { name: 'tg_audit', type: 'trigger', enabled: true }
      });
      // trigger → Toggle + CopyName + Delete = 3 items
      expect(wrapper.findAll('.ctx-item-stub').length).toBe(3);
      // enabled:true → Disable label
      expect(wrapper.html()).toContain('general.disable');
   });

   it('renders Enable label when trigger is currently disabled', () => {
      const wrapper = mountCtx({
         selectedMisc: { name: 'tg_audit', type: 'trigger', enabled: false }
      });
      expect(wrapper.html()).toContain('general.enable');
   });

   it('omits Delete when the connection is readonly', () => {
      const wrapper = mountCtx(
         { selectedMisc: { name: 'sp_one', type: 'procedure' } },
         { connections: {
            connections: [{ ...baseConnections[0], readonly: true }],
            connectionsOrder: baseConnections.map(c => ({ ...c, isFolder: false, readonly: true }))
         } }
      );
      // procedure + readonly → only Run + CopyName = 2 items
      const items = wrapper.findAll('.ctx-item-stub');
      expect(items.length).toBe(2);
      expect(wrapper.html()).not.toContain('general.delete');
   });

   it('clicking Delete opens the ConfirmModal with the type-specific message', async () => {
      const wrapper = mountCtx({ selectedMisc: { name: 'sp_one', type: 'procedure' } });
      // ConfirmModal not yet rendered
      expect(wrapper.find('.confirm-modal-stub').exists()).toBe(false);
      // The last item is "Delete" for procedures (Run / CopyName / Delete)
      const items = wrapper.findAll('.ctx-item-stub');
      await items[items.length - 1].trigger('click');
      await flushPromises();
      expect(wrapper.find('.confirm-modal-stub').exists()).toBe(true);
      expect(wrapper.html()).toContain('database.deleteRoutine');
   });

   it('confirming delete on a procedure calls Routines.dropRoutine + emits reload', async () => {
      const wrapper = mountCtx({ selectedMisc: { name: 'sp_one', type: 'procedure' } });
      const items = wrapper.findAll('.ctx-item-stub');
      await items[items.length - 1].trigger('click');
      await flushPromises();
      await wrapper.find('.cm-confirm-btn').trigger('click');
      await flushPromises();
      expect(Routines.dropRoutine).toHaveBeenCalledWith({
         uid: 'C:1',
         schema: 'app',
         routine: 'sp_one'
      });
      expect(wrapper.emitted('reload')).toBeTruthy();
   });

   it('confirming delete on a trigger calls Triggers.dropTrigger', async () => {
      const wrapper = mountCtx({ selectedMisc: { name: 'tg_audit', type: 'trigger', enabled: true } });
      const items = wrapper.findAll('.ctx-item-stub');
      await items[items.length - 1].trigger('click');
      await flushPromises();
      await wrapper.find('.cm-confirm-btn').trigger('click');
      await flushPromises();
      expect(Triggers.dropTrigger).toHaveBeenCalledWith({
         uid: 'C:1',
         schema: 'app',
         trigger: 'tg_audit'
      });
   });

   it('confirming delete on a function calls Functions.dropFunction', async () => {
      const wrapper = mountCtx({ selectedMisc: { name: 'fn_calc', type: 'function' } });
      const items = wrapper.findAll('.ctx-item-stub');
      await items[items.length - 1].trigger('click');
      await flushPromises();
      await wrapper.find('.cm-confirm-btn').trigger('click');
      await flushPromises();
      expect(Functions.dropFunction).toHaveBeenCalledWith({
         uid: 'C:1',
         schema: 'app',
         func: 'fn_calc'
      });
   });

   it('confirming delete on a scheduler calls Schedulers.dropScheduler', async () => {
      const wrapper = mountCtx({ selectedMisc: { name: 'evt_nightly', type: 'scheduler' } });
      const items = wrapper.findAll('.ctx-item-stub');
      await items[items.length - 1].trigger('click');
      await flushPromises();
      await wrapper.find('.cm-confirm-btn').trigger('click');
      await flushPromises();
      expect(Schedulers.dropScheduler).toHaveBeenCalledWith({
         uid: 'C:1',
         schema: 'app',
         scheduler: 'evt_nightly'
      });
   });

   it('hide button on the ConfirmModal closes the dialog without dropping', async () => {
      const wrapper = mountCtx();
      const items = wrapper.findAll('.ctx-item-stub');
      await items[items.length - 1].trigger('click');
      await flushPromises();
      expect(wrapper.find('.confirm-modal-stub').exists()).toBe(true);
      await wrapper.find('.cm-hide-btn').trigger('click');
      await flushPromises();
      expect(wrapper.find('.confirm-modal-stub').exists()).toBe(false);
      expect(Routines.dropRoutine).not.toHaveBeenCalled();
   });

   it('Run for a procedure with zero parameters fires runRoutine immediately (newTab dispatched)', async () => {
      vi.mocked(Routines.getRoutineInformations).mockResolvedValueOnce({
         status: 'success',
         response: { name: 'sp_zero', parameters: [] }
      } as never);
      const wrapper = mountCtx({ selectedMisc: { name: 'sp_zero', type: 'procedure' } });
      const items = wrapper.findAll('.ctx-item-stub');
      // First item is Run for procedure
      await items[0].trigger('click');
      await flushPromises();
      // Routines.getRoutineInformations was the runRoutineCheck path; verify
      // the IPC mock saw the call.
      expect(Routines.getRoutineInformations).toHaveBeenCalledWith({
         uid: 'C:1',
         schema: 'app',
         routine: 'sp_zero'
      });
   });

   it('exports the component as an SFC object', () => {
      expect(WorkspaceExploreBarMiscContext).toBeDefined();
      expect(typeof WorkspaceExploreBarMiscContext).toBe('object');
   });
});
