/**
 * Tests for WorkspaceTabNewView.vue — the "Create new view" tab. Owns:
 *   - localView ref initialised from a fixed originalView template
 *   - isChanged computed (deep-clone equality on localView vs originalView)
 *   - saveChanges → Views.createView → newTab + removeTab on success
 *   - clearChanges → reset localView + queryEditor.editor.session.setValue
 *   - resizeQueryEditor → queryEditor.editor.resize() + bounding-rect math
 *   - watch on isSelected / isChanged / consoleHeight
 *
 * Mirrors WorkspaceTabNewMaterializedView's structure; only the IPC method
 * (createView vs createMaterializedView) and resulting tab type differ.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import Views from '@/ipc-api/Views';

import WorkspaceTabNewView from './WorkspaceTabNewView.vue';

vi.mock('@/ipc-api/Views', () => ({
   default: {
      createView: vi.fn().mockResolvedValue({ status: 'success', response: null }),
      createMaterializedView: vi.fn().mockResolvedValue({ status: 'success', response: null })
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
   return mountWithPinia(WorkspaceTabNewView, {
      props: {
         tabUid: 'T:2',
         connection: { uid: 'C:1', client: 'mysql' },
         tab: { uid: 'T:2' },
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

describe('WorkspaceTabNewView', () => {
   it('exports the component definition', () => {
      expect(WorkspaceTabNewView).toBeDefined();
      expect(typeof WorkspaceTabNewView).toBe('object');
   });

   it('mounts without throwing under default props', async () => {
      expect(() => mountTab()).not.toThrow();
      await flushPromises();
   });

   it('renders Save and Clear toolbar buttons via the toolbar slot', async () => {
      const wrapper = mountTab();
      await flushPromises();
      expect(wrapper.html()).toContain('general.save');
      expect(wrapper.html()).toContain('general.clear');
   });

   it('renders Name input in metadata slot', async () => {
      const wrapper = mountTab();
      await flushPromises();
      expect(wrapper.find('.property-card-stub').exists()).toBe(true);
      expect(wrapper.html()).toContain('general.name');
   });

   it('disables both Save and Clear buttons when no changes have been made', async () => {
      const wrapper = mountTab();
      await flushPromises();
      const buttons = wrapper.findAll('.btn-stub');
      const saveBtn = buttons.find(b => b.text().includes('general.save'));
      const clearBtn = buttons.find(b => b.text().includes('general.clear'));
      expect(saveBtn!.attributes('disabled')).toBeDefined();
      expect(clearBtn!.attributes('disabled')).toBeDefined();
   });

   it('renders the QueryEditor stub in content slot', async () => {
      const wrapper = mountTab();
      await flushPromises();
      expect(wrapper.find('.query-editor-stub').exists()).toBe(true);
   });

   it('hides definer card when workspace customization disables it', async () => {
      const wrapper = mountTab({}, {
         customizations: { ...baseCustomizations, definer: false }
      });
      await flushPromises();
      expect(wrapper.html()).not.toContain('database.definer');
   });

   it('hides updateOption card when customization disables it', async () => {
      const wrapper = mountTab({}, {
         customizations: { ...baseCustomizations, viewUpdateOption: false }
      });
      await flushPromises();
      expect(wrapper.html()).not.toContain('database.updateOption');
   });

   it('does not call createView at mount time', async () => {
      mountTab();
      await flushPromises();
      expect(Views.createView).not.toHaveBeenCalled();
   });

   it('exposes Views.createView mock as a function', () => {
      expect(typeof Views.createView).toBe('function');
   });

   it('renders the selectStatement label in content slot', async () => {
      const wrapper = mountTab();
      await flushPromises();
      expect(wrapper.html()).toContain('database.selectStatement');
   });
});
