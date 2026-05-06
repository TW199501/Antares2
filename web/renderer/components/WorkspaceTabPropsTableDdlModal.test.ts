/**
 * Tests for WorkspaceTabPropsTableDdlModal.vue — the "View DDL" modal opened
 * from the table-props tab. On mount, calls Tables.getTableDll(uid, schema,
 * table) and stuffs the response into a read-only BaseTextEditor.
 *
 * Owns:
 *   - onMounted async fetch + addNotification on error
 *   - copyDdl() which uses navigator.clipboard.writeText, with a success
 *     toast on resolve and error toast on reject
 *   - emit 'hide' wired through the BaseConfirmModal stub
 *
 * Strategy:
 *   - mountWithPinia (notifications store seeded)
 *   - stub BaseConfirmModal as a slot-passthrough that re-emits @hide
 *   - stub BaseTextEditor entirely (spec §5.F)
 *   - stub Button as a passthrough so we can find the "Copy" button
 *   - mock Tables.getTableDll to return a deterministic SQL string
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Tables from '@/ipc-api/Tables';

import WorkspaceTabPropsTableDdlModal from './WorkspaceTabPropsTableDdlModal.vue';

vi.mock('@/ipc-api/Tables', () => ({
   default: {
      getTableDll: vi.fn().mockResolvedValue({
         status: 'success',
         response: 'CREATE TABLE users (id INT PRIMARY KEY)'
      })
   }
}));

const ConfirmModalStub = {
   name: 'ConfirmModal',
   inheritAttrs: false,
   emits: ['hide', 'confirm'],
   template: `
      <div class="confirm-modal-stub" v-bind="$attrs">
         <div class="cm-header"><slot name="header" /></div>
         <div data-modal-body class="cm-body"><slot name="body" /></div>
         <button type="button" class="cm-hide-btn" @click="$emit('hide')">hide</button>
      </div>
   `
};

const ButtonStub = {
   name: 'Button',
   inheritAttrs: false,
   props: { disabled: { type: Boolean, default: false } },
   template: '<button type="button" class="btn-stub" :disabled="disabled" v-bind="$attrs"><slot /></button>'
};

const baseWorkspace = {
   uid: 'C:1',
   client: 'mysql',
   database: 'app'
};

const mountModal = (
   propOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(WorkspaceTabPropsTableDdlModal, {
      props: {
         table: 'users',
         schema: 'app',
         workspace: baseWorkspace,
         ...propOverrides
      } as never,
      initialState: {
         notifications: { notifications: [] }
      },
      stubActions: true,
      global: {
         stubs: {
            BaseIcon: true,
            BaseTextEditor: true,
            ConfirmModal: ConfirmModalStub,
            Button: ButtonStub
         }
      }
   });
};

afterEach(() => {
   vi.clearAllMocks();
});

describe('WorkspaceTabPropsTableDdlModal', () => {
   it('mounts without throwing and calls Tables.getTableDll with right params', async () => {
      const wrapper = mountModal();
      await flushPromises();
      expect(Tables.getTableDll).toHaveBeenCalledWith({
         uid: 'C:1',
         table: 'users',
         schema: 'app'
      });
      expect(wrapper.find('.confirm-modal-stub').exists()).toBe(true);
   });

   it('renders the table name in the header', async () => {
      const wrapper = mountModal({ table: 'orders' });
      await flushPromises();
      expect(wrapper.find('.cm-header').html()).toContain('orders');
      expect(wrapper.find('.cm-header').html()).toContain('database.ddl');
   });

   it('renders a Copy button with the i18n label "general.copy"', async () => {
      const wrapper = mountModal();
      await flushPromises();
      const btn = wrapper.find('.btn-stub');
      expect(btn.exists()).toBe(true);
      expect(btn.html()).toContain('general.copy');
   });

   it('Copy button is disabled until the DDL fetch resolves', async () => {
      // Make the mock pending until we manually flush
      let resolveFn!: (v: unknown) => void;
      vi.mocked(Tables.getTableDll).mockImplementationOnce(
         () => new Promise(_resolve => {
            resolveFn = _resolve;
         }) as never
      );
      const wrapper = mountModal();
      // Before the fetch resolves, createDdl is empty -> :disabled="!createDdl" is true
      const btn = wrapper.find('.btn-stub');
      expect(btn.attributes('disabled')).toBeDefined();
      resolveFn({ status: 'success', response: 'CREATE TABLE x()' });
      await flushPromises();
   });

   it('clicking hide on the ConfirmModal stub re-emits hide on the SFC', async () => {
      const wrapper = mountModal();
      await flushPromises();
      await wrapper.find('.cm-hide-btn').trigger('click');
      expect(wrapper.emitted('hide')).toBeTruthy();
   });

   it('addNotification is called with success when copyDdl resolves', async () => {
      // Stub navigator.clipboard.writeText to succeed
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(globalThis.navigator, 'clipboard', {
         value: { writeText },
         configurable: true
      });
      const wrapper = mountModal();
      await flushPromises();
      const { useNotificationsStore } = await import('@/stores/notifications');
      const store = useNotificationsStore();
      await wrapper.find('.btn-stub').trigger('click');
      await flushPromises();
      expect(writeText).toHaveBeenCalledWith('CREATE TABLE users (id INT PRIMARY KEY)');
      expect(store.addNotification).toHaveBeenCalledWith(
         expect.objectContaining({ status: 'success' })
      );
   });

   it('addNotification is called with error when getTableDll status != success', async () => {
      vi.mocked(Tables.getTableDll).mockResolvedValueOnce({
         status: 'error',
         response: 'permission denied'
      } as never);
      mountModal();
      await flushPromises();
      const { useNotificationsStore } = await import('@/stores/notifications');
      const store = useNotificationsStore();
      expect(store.addNotification).toHaveBeenCalledWith(
         expect.objectContaining({ status: 'error', message: 'permission denied' })
      );
   });

   it('exports the component as an SFC object', () => {
      expect(WorkspaceTabPropsTableDdlModal).toBeDefined();
      expect(typeof WorkspaceTabPropsTableDdlModal).toBe('object');
   });
});
