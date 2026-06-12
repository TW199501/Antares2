/**
 * Tests for WorkspaceAddConnectionPanel.vue — the "create new connection"
 * panel rendered when there's no selected workspace yet.
 *
 * Differences from EditConnectionPanel:
 *   - Owns its own `connection` ref initialized from defaults (not props)
 *   - watch on connection.client → resets user/port/database from
 *     clientCustomizations
 *   - saveConnection runs addConnection (connections store) +
 *     selectWorkspace (workspaces store)
 *   - DebugConsole renders below the panel when isConsoleOpen store flag
 *   - Has SSL/SSH "enable" labels with @click.prevent toggleSsl/toggleSsh
 *
 * We stub Reka primitives + heavy children identically to EditConnection
 * tests; addConnection / selectWorkspace are auto-spied via stubActions.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import Connection from '@/ipc-api/Connection';
import { useConnectionsStore } from '@/stores/connections';
import { useWorkspacesStore } from '@/stores/workspaces';

import WorkspaceAddConnectionPanel from './WorkspaceAddConnectionPanel.vue';

vi.mock('@/ipc-api/Connection', () => ({
   default: {
      makeTest: vi.fn().mockResolvedValue({ status: 'success', response: {} }),
      abortConnection: vi.fn()
   }
}));

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

const InputStub = {
   inheritAttrs: false,
   props: { modelValue: { type: [String, Number], default: '' } },
   emits: ['update:modelValue'],
   template: '<input class="input-stub" v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
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

const mountPanel = (consoleOpen = false) =>
   mountWithPinia(WorkspaceAddConnectionPanel, {
      initialState: {
         workspaces: { workspaces: [], selectedWorkspace: null },
         connections: { connections: [], connectionsOrder: [] },
         notifications: { notifications: [] },
         console: { isConsoleOpen: consoleOpen }
      },
      stubActions: true,
      global: {
         stubs: {
            BaseIcon: true,
            BaseSelect: BaseSelectStub,
            BaseUploadInput: BaseUploadInputStub,
            DebugConsole: true,
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
            Input: InputStub,
            Checkbox: CheckboxStub
         }
      }
   });

describe('WorkspaceAddConnectionPanel', () => {
   it('mounts without throwing and seeds default state', async () => {
      expect(() => mountPanel()).not.toThrow();
      await flushPromises();
   });

   it('renders the createNewConnection header label', async () => {
      const wrapper = mountPanel();
      await flushPromises();
      expect(wrapper.html()).toContain('connection.createNewConnection');
   });

   it('renders the General + SSL + SSH tab triggers (mysql default)', async () => {
      const wrapper = mountPanel();
      await flushPromises();
      const triggers = wrapper.findAll('.tabs-trigger-stub').map(b => b.attributes('data-value'));
      expect(triggers).toEqual(['general', 'ssl', 'ssh']);
      expect(wrapper.find('.tabs-stub').attributes('data-active')).toBe('general');
   });

   it('Save button calls addConnection + selectWorkspace from stores', async () => {
      const wrapper = mountPanel();
      await flushPromises();
      const connStore = useConnectionsStore();
      const wsStore = useWorkspacesStore();
      await wrapper.find('#connection-save').trigger('click');
      await flushPromises();
      expect(connStore.addConnection).toHaveBeenCalledTimes(1);
      const seeded = vi.mocked(connStore.addConnection).mock.calls[0]?.[0];
      expect(seeded).toMatchObject({ client: 'mysql', host: '127.0.0.1' });
      expect(wsStore.selectWorkspace).toHaveBeenCalledWith(seeded.uid);
   });

   it('Test button calls Connection.makeTest with current connection ref', async () => {
      const wrapper = mountPanel();
      await flushPromises();
      await wrapper.find('#connection-test').trigger('click');
      await flushPromises();
      expect(Connection.makeTest).toHaveBeenCalledTimes(1);
      expect(vi.mocked(Connection.makeTest).mock.calls[0]?.[0]).toMatchObject({ client: 'mysql' });
   });

   it('Test with ask=true (set via Checkbox) opens credentials modal instead of calling makeTest', async () => {
      const wrapper = mountPanel();
      await flushPromises();
      // Find the "ask credentials" Checkbox stub — the second one if readOnlyMode + ask exist.
      const checkboxes = wrapper.findAll('.checkbox-stub');
      // mysql has readOnlyMode + ask + singleConnection → first is readOnlyMode, second is ask
      expect(checkboxes.length).toBeGreaterThanOrEqual(2);
      await checkboxes[1].setValue(true);
      await flushPromises();
      vi.mocked(Connection.makeTest).mockClear();
      await wrapper.find('#connection-test').trigger('click');
      await flushPromises();
      expect(Connection.makeTest).not.toHaveBeenCalled();
      expect(wrapper.html()).toContain('modal-ask-credentials-stub');
   });

   it('renders DebugConsole when isConsoleOpen store flag is true', async () => {
      const wrapper = mountPanel(true);
      await flushPromises();
      expect(wrapper.html()).toContain('debug-console-stub');
   });

   it('hides DebugConsole when isConsoleOpen is false', async () => {
      const wrapper = mountPanel(false);
      await flushPromises();
      expect(wrapper.html()).not.toContain('debug-console-stub');
   });

   it('changing client through BaseSelect triggers a watch that resets defaults (no throw)', async () => {
      const wrapper = mountPanel();
      await flushPromises();
      const select = wrapper.find('.base-select-stub');
      // Set value to "pg" — watch will mutate user / port / database
      await select.setValue('pg');
      await flushPromises();
      // Connection-string field becomes visible (pg-only branch)
      const fields = wrapper.findAll('.form-field-stub').map(f => f.attributes('data-label'));
      expect(fields).toContain('connection.connectionString');
   });

   it('BaseUploadInput @select on databasePath populates the value (sqlite path branch reachable)', async () => {
      const wrapper = mountPanel();
      await flushPromises();
      // Default mysql doesn't show databasePath; switch client → sqlite
      const select = wrapper.find('.base-select-stub');
      await select.setValue('sqlite');
      await flushPromises();
      const pickBtn = wrapper.find('.upload-select-btn');
      expect(pickBtn.exists()).toBe(true);
      await pickBtn.trigger('click');
      await flushPromises();
      expect(wrapper.html()).toContain('/tmp/picked');
   });

   it('error response from Connection.makeTest is swallowed (no throw)', async () => {
      vi.mocked(Connection.makeTest).mockResolvedValueOnce({ status: 'error', response: { message: 'auth failed' } } as never);
      const wrapper = mountPanel();
      await flushPromises();
      await wrapper.find('#connection-test').trigger('click');
      await flushPromises();
      expect(Connection.makeTest).toHaveBeenCalled();
   });

   it('cleans up on unmount (smoke)', async () => {
      const wrapper = mountPanel();
      await flushPromises();
      expect(() => wrapper.unmount()).not.toThrow();
   });
});
