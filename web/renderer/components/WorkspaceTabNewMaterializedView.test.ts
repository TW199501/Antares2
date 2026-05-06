/**
 * Tests for WorkspaceTabNewMaterializedView.vue — the "Create new materialized
 * view" tab. Owns:
 *   - localView ref initialised from a fixed originalView template
 *   - isChanged computed (deep-clone equality on localView vs originalView)
 *   - saveChanges → Views.createMaterializedView → newTab + removeTab on success
 *   - clearChanges → reset localView + queryEditor.editor.session.setValue
 *   - resizeQueryEditor → queryEditor.editor.resize() + bounding-rect math
 *   - watch on isSelected / isChanged / consoleHeight
 *
 * The component reads `queryEditor.value.editor.session.setValue` and
 * `queryEditor.value.$el.getBoundingClientRect()`, so the QueryEditor stub
 * exposes both via Vue data().
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import Views from '@/ipc-api/Views';

import WorkspaceTabNewMaterializedView from './WorkspaceTabNewMaterializedView.vue';

vi.mock('@/ipc-api/Views', () => ({
   default: {
      createMaterializedView: vi.fn().mockResolvedValue({ status: 'success', response: null }),
      createView: vi.fn().mockResolvedValue({ status: 'success', response: null })
   }
}));

const baseCustomizations = {
   definer: true,
   viewSqlSecurity: true,
   viewAlgorithm: true,
   viewUpdateOption: true
};

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
   users: [{ host: 'localhost', name: 'root' }],
   customizations: baseCustomizations
};

const QueryEditorStub = {
   name: 'QueryEditor',
   props: ['modelValue', 'workspace', 'schema', 'height'],
   emits: ['update:modelValue'],
   data () {
      return {
         editor: {
            session: { setValue: vi.fn() },
            resize: vi.fn()
         }
      };
   },
   template: '<div class="query-editor-stub" />'
};

const SelectStub = {
   name: 'BaseSelect',
   props: { modelValue: { type: [String, Number, Boolean, Object, null] as never, default: null } },
   emits: ['update:modelValue'],
   template: '<div class="select-stub" :data-value="String(modelValue)" />'
};

const InputStub = {
   name: 'Input',
   inheritAttrs: false,
   props: { modelValue: { type: [String, Number, null] as never, default: '' } },
   emits: ['update:modelValue'],
   template: '<input class="input-stub" v-bind="$attrs" :value="modelValue" />'
};

const ButtonStub = {
   name: 'Button',
   inheritAttrs: false,
   emits: ['click'],
   template: '<button type="button" class="btn-stub" v-bind="$attrs" @click="$emit(\'click\', $event)"><slot /></button>'
};

const mountTab = (
   propOverrides: Record<string, unknown> = {},
   workspaceOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(WorkspaceTabNewMaterializedView, {
      props: {
         tabUid: 'T:1',
         connection: { uid: 'C:1', client: 'mysql' },
         tab: { uid: 'T:1' },
         isSelected: true,
         schema: 'app',
         ...propOverrides
      } as never,
      initialState: {
         workspaces: {
            workspaces: [{ ...baseWorkspace, ...workspaceOverrides }],
            selectedWorkspace: 'C:1'
         },
         notifications: { notifications: [] },
         console: { consoleHeight: 0, isConsoleVisible: false }
      },
      stubActions: true,
      global: {
         stubs: {
            BaseIcon: true,
            BaseLoader: true,
            BaseSelect: SelectStub,
            Button: ButtonStub,
            Input: InputStub,
            Label: { template: '<label class="label-stub" v-bind="$attrs"><slot /></label>' },
            QueryEditor: QueryEditorStub,
            PropertyCard: { template: '<div class="property-card-stub"><slot /></div>' },
            PropsTabShell: {
               template: `
                  <div class="props-tab-shell-stub">
                     <div class="toolbar-slot"><slot name="toolbar" /></div>
                     <div class="metadata-slot"><slot name="metadata" /></div>
                     <div class="content-slot"><slot name="content" /></div>
                  </div>
               `
            }
         }
      }
   });
};

describe('WorkspaceTabNewMaterializedView', () => {
   it('exports the component definition', () => {
      expect(WorkspaceTabNewMaterializedView).toBeDefined();
      expect(typeof WorkspaceTabNewMaterializedView).toBe('object');
   });

   it('mounts without throwing under default props', async () => {
      expect(() => mountTab()).not.toThrow();
      await flushPromises();
   });

   it('renders Save and Clear toolbar buttons', async () => {
      const wrapper = mountTab();
      await flushPromises();
      expect(wrapper.html()).toContain('general.save');
      expect(wrapper.html()).toContain('general.clear');
   });

   it('renders metadata PropertyCards including Name input', async () => {
      const wrapper = mountTab();
      await flushPromises();
      expect(wrapper.find('.property-card-stub').exists()).toBe(true);
      expect(wrapper.html()).toContain('general.name');
   });

   it('disables Save button when no changes have been made', async () => {
      const wrapper = mountTab();
      await flushPromises();
      const saveBtn = wrapper.findAll('.btn-stub').find(b => b.text().includes('general.save'));
      expect(saveBtn).toBeTruthy();
      expect(saveBtn!.attributes('disabled')).toBeDefined();
   });

   it('renders the QueryEditor in content slot', async () => {
      const wrapper = mountTab();
      await flushPromises();
      expect(wrapper.find('.query-editor-stub').exists()).toBe(true);
   });

   it('honours customizations to hide algorithm card when flag is false', async () => {
      const wrapper = mountTab({}, {
         customizations: { ...baseCustomizations, viewAlgorithm: false }
      });
      await flushPromises();
      expect(wrapper.html()).not.toContain('database.algorithm');
   });

   it('exposes Views.createMaterializedView mock as a function', () => {
      expect(typeof Views.createMaterializedView).toBe('function');
   });

   it('does not call createMaterializedView at mount time', async () => {
      mountTab();
      await flushPromises();
      expect(Views.createMaterializedView).not.toHaveBeenCalled();
   });

   it('renders selectStatement label in content slot', async () => {
      const wrapper = mountTab();
      await flushPromises();
      expect(wrapper.html()).toContain('database.selectStatement');
   });
});
