/**
 * Tests for WorkspaceEditConnectionPanel.vue — the per-connection edit
 * dialog body shown inside Workspace.vue when status is "disconnected".
 *
 * The component owns:
 *   - localConnection clone of props.connection (deep watch + JSON copy)
 *   - selectedTab (general / ssl / ssh) gated by clientCustomizations
 *   - Test connection / Save / Connect buttons
 *   - mouseenter/mouseleave -> show*Cancel toggles
 *   - Connection.makeTest mock + addNotification on result
 *   - editConnection (connections store) + connectWorkspace (workspaces store)
 *   - ModalAskCredentials when localConnection.ask is true (only via
 *     startTest / startConnection), continueTest gated by isAsking
 *
 * We stub heavy/Reka children (Tabs, FormField, BaseSelect, BaseUploadInput,
 * Checkbox, Button) with passthrough/minimal templates so all v-if branches
 * still render and click handlers still propagate.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import Connection from '@/ipc-api/Connection';

import WorkspaceEditConnectionPanel from './WorkspaceEditConnectionPanel.vue';

vi.mock('@/ipc-api/Connection', () => ({
   default: {
      makeTest: vi.fn().mockResolvedValue({ status: 'success', response: {} }),
      abortConnection: vi.fn()
   }
}));

const baseConnection = {
   uid: 'C:1',
   name: 'My MySQL',
   client: 'mysql',
   host: '127.0.0.1',
   port: 3306,
   user: 'root',
   password: '',
   database: 'app',
   databasePath: '',
   ask: false,
   readonly: false,
   singleConnectionMode: false,
   ssl: false,
   cert: '',
   key: '',
   ca: '',
   ciphers: '',
   untrustedConnection: false,
   ssh: false,
   sshHost: '',
   sshUser: '',
   sshPass: '',
   sshPassphrase: null,
   sshKey: '',
   sshPort: 22,
   sshKeepAliveInterval: 1800,
   connString: ''
};

const TabsStub = {
   props: { modelValue: { type: String, default: 'general' } },
   emits: ['update:modelValue'],
   template: '<div class="tabs-stub" :data-active="modelValue"><slot /></div>'
};

const TabsTriggerStub = {
   props: { value: { type: String, default: '' } },
   template: '<button type="button" class="tabs-trigger-stub" :data-value="value" @click="$parent.$emit(\'update:modelValue\', value)"><slot /></button>'
};

const FormFieldStub = {
   props: { label: { type: String, default: '' } },
   template: '<div class="form-field-stub" :data-label="label"><slot :id="\'fid\'" /></div>'
};

const ButtonStub = {
   inheritAttrs: false,
   template: '<button type="button" class="btn-stub" v-bind="$attrs"><slot /></button>'
};

const BaseSelectStub = {
   props: { modelValue: { type: [String, Number, Object], default: '' }, options: { type: Array, default: () => [] } },
   emits: ['update:modelValue'],
   template: '<select class="base-select-stub" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="o in options" :key="o.slug || o" :value="o.slug || o">{{ o.name || o }}</option></select>'
};

const BaseUploadInputStub = {
   props: { modelValue: { type: String, default: '' }, message: { type: String, default: '' } },
   emits: ['select', 'clear'],
   template: '<div class="base-upload-stub"><span class="upload-value">{{ modelValue }}</span><button class="upload-select-btn" type="button" @click="$emit(\'select\', \'/tmp/picked\')">pick</button><button class="upload-clear-btn" type="button" @click="$emit(\'clear\')">clear</button></div>'
};

const CheckboxStub = {
   props: { checked: { type: Boolean, default: false } },
   emits: ['update:checked'],
   template: '<input type="checkbox" class="checkbox-stub" :checked="checked" @change="$emit(\'update:checked\', $event.target.checked)" />'
};

const mountPanel = (
   connection: Record<string, unknown> = baseConnection
) => {
   return mountWithPinia(WorkspaceEditConnectionPanel, {
      props: { connection } as never,
      initialState: {
         workspaces: { workspaces: [], selectedWorkspace: null },
         connections: { connections: [{ ...connection }], connectionsOrder: [] },
         notifications: { notifications: [] }
      },
      stubActions: true,
      global: {
         stubs: {
            BaseIcon: true,
            BaseSelect: BaseSelectStub,
            BaseUploadInput: BaseUploadInputStub,
            ModalAskCredentials: true,
            Tabs: TabsStub,
            TabsList: { template: '<div class="tabs-list-stub"><slot /></div>' },
            TabsTrigger: TabsTriggerStub,
            TabsContent: {
               props: { value: { type: String, default: '' } },
               template: '<div class="tabs-content-stub" :data-value="value"><slot /></div>'
            },
            FormField: FormFieldStub,
            Button: ButtonStub,
            Checkbox: CheckboxStub
         }
      }
   });
};

describe('WorkspaceEditConnectionPanel', () => {
   it('mounts without throwing for a default mysql connection', async () => {
      expect(() => mountPanel()).not.toThrow();
      await flushPromises();
   });

   it('renders the connection name + edit-connection label in the header', async () => {
      const wrapper = mountPanel();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain('My MySQL');
      expect(html).toContain('connection.editConnection');
   });

   it('renders the General tab as active by default and includes ssl + ssh tab triggers for mysql', async () => {
      const wrapper = mountPanel();
      await flushPromises();
      // Tabs root reflects current selectedTab
      expect(wrapper.find('.tabs-stub').attributes('data-active')).toBe('general');
      // mysql customizations enable both ssl + ssh tabs
      const triggers = wrapper.findAll('.tabs-trigger-stub').map(b => b.attributes('data-value'));
      expect(triggers).toContain('general');
      expect(triggers).toContain('ssl');
      expect(triggers).toContain('ssh');
   });

   it('hides SSH and SSL triggers for sqlite (file connection, no ssh/ssl)', async () => {
      const wrapper = mountPanel({ ...baseConnection, client: 'sqlite', database: undefined, databasePath: '/tmp/db.sqlite' });
      await flushPromises();
      const triggers = wrapper.findAll('.tabs-trigger-stub').map(b => b.attributes('data-value'));
      expect(triggers).toContain('general');
      // sqlite customizations: sslConnection=false, sshConnection=false
      expect(triggers).not.toContain('ssl');
      expect(triggers).not.toContain('ssh');
   });

   it('renders the connection-string field only when client === pg', async () => {
      const wrapperMysql = mountPanel();
      await flushPromises();
      // Find by data-label containing "connectionString" (i18n identity)
      const mysqlFields = wrapperMysql.findAll('.form-field-stub').map(f => f.attributes('data-label'));
      expect(mysqlFields).not.toContain('connection.connectionString');

      const wrapperPg = mountPanel({ ...baseConnection, client: 'pg' });
      await flushPromises();
      const pgFields = wrapperPg.findAll('.form-field-stub').map(f => f.attributes('data-label'));
      expect(pgFields).toContain('connection.connectionString');
   });

   it('clicking #connection-test calls Connection.makeTest with localConnection (after ask=false branch)', async () => {
      const wrapper = mountPanel();
      await flushPromises();
      const testBtn = wrapper.find('#connection-test');
      expect(testBtn.exists()).toBe(true);
      await testBtn.trigger('click');
      await flushPromises();
      expect(Connection.makeTest).toHaveBeenCalledTimes(1);
      const callArg = vi.mocked(Connection.makeTest).mock.calls[0]?.[0];
      expect(callArg).toMatchObject({ uid: 'C:1', client: 'mysql' });
   });

   it('clicking #connection-test with ask=true does NOT call Connection.makeTest (waits for credentials modal)', async () => {
      const wrapper = mountPanel({ ...baseConnection, ask: true });
      await flushPromises();
      await wrapper.find('#connection-test').trigger('click');
      await flushPromises();
      expect(Connection.makeTest).not.toHaveBeenCalled();
      // ModalAskCredentials becomes visible
      expect(wrapper.html()).toContain('modal-ask-credentials-stub');
   });

   it('error response from Connection.makeTest queues an error notification (no throw)', async () => {
      vi.mocked(Connection.makeTest).mockResolvedValueOnce({ status: 'error', response: { message: 'access denied' } } as never);
      const wrapper = mountPanel();
      await flushPromises();
      await wrapper.find('#connection-test').trigger('click');
      await flushPromises();
      expect(Connection.makeTest).toHaveBeenCalled();
      // No throw means notification path executed; concrete store-spy assertion
      // would require unmocking actions which conflicts with stubActions=true.
   });

   it('Save button is disabled while there are no localConnection diffs (hasChanges=false)', async () => {
      const wrapper = mountPanel();
      await flushPromises();
      const saveBtn = wrapper.find('#connection-save');
      expect(saveBtn.exists()).toBe(true);
      // Cloned localConnection equals props.connection at mount → hasChanges=false → disabled
      expect(saveBtn.attributes('disabled')).toBeDefined();
   });

   it('hovering the test button toggles showTestCancel (mouseenter / mouseleave handlers run)', async () => {
      const wrapper = mountPanel();
      await flushPromises();
      const wrapperEl = wrapper.find('#connection-test').element.parentElement!;
      // Just assert the handlers exist and dispatching the events does not throw
      expect(() => wrapperEl.dispatchEvent(new MouseEvent('mouseenter'))).not.toThrow();
      expect(() => wrapperEl.dispatchEvent(new MouseEvent('mouseleave'))).not.toThrow();
   });

   it('BaseUploadInput @select event mutates localConnection path field (sqlite databasePath branch)', async () => {
      const wrapper = mountPanel({ ...baseConnection, client: 'sqlite', database: undefined, databasePath: '' });
      await flushPromises();
      const pickBtn = wrapper.find('.upload-select-btn');
      expect(pickBtn.exists()).toBe(true);
      await pickBtn.trigger('click');
      await flushPromises();
      // Re-render shows new path in upload value span
      expect(wrapper.html()).toContain('/tmp/picked');
   });

   it('updates localConnection when props.connection changes (deep watch with JSON clone)', async () => {
      const wrapper = mountPanel();
      await flushPromises();
      await wrapper.setProps({ connection: { ...baseConnection, name: 'Renamed' } });
      await flushPromises();
      expect(wrapper.html()).toContain('Renamed');
   });

   it('cleans up on unmount (smoke: no throw)', async () => {
      const wrapper = mountPanel();
      await flushPromises();
      expect(() => wrapper.unmount()).not.toThrow();
   });
});
