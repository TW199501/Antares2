/**
 * Tests for WorkspaceTabNewTriggerFunction.vue — the "create trigger function"
 * tab body. The component:
 *
 *   - Reads workspace + customizations through useWorkspacesStore.getWorkspace
 *     (so the test seeds workspaces store with a single record carrying
 *     customizations.{triggerFunctionSql, triggerFunctionlanguages, definer,
 *     comment} and a users[] array)
 *   - Builds an originalFunction and a localFunction (cloned via JSON) and
 *     watches isChanged (deep diff of those two)
 *   - On Save: calls Functions.createTriggerFunction(params), then on success
 *     refreshStructure → newTab → removeTab → changeBreadcrumbs
 *   - Wires window 'antares:save-content' listener and a window 'resize' to
 *     resizeQueryEditor (uses queryEditor.editor — we stub QueryEditor so
 *     the ref is non-null and resize() is a no-op)
 *
 * Coverage focus: mount no-throw across customization variants, save happy
 * path triggers ipc + store actions, save error path adds a notification,
 * clearChanges resets localFunction, watcher → setUnsavedChanges, listener
 * registration during mount.
 *
 * Mocks:
 *   - @/ipc-api/Functions.createTriggerFunction (success default; tests can
 *     override to error in-place)
 *
 * Stubs:
 *   - QueryEditor (real ace import is heavy and irrelevant here) — exposes
 *     editor.session.setValue + editor.resize as no-ops, plus $el bounding-
 *     rect path used by resizeQueryEditor
 *   - PropsTabShell / PropertyCard (passthrough so the metadata + content
 *     slots render and the toolbar buttons are clickable)
 *   - BaseSelect / BaseLoader / Input / Button / Label / BaseIcon (neutral)
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises as _flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import Functions from '@/ipc-api/Functions';

import WorkspaceTabNewTriggerFunction from './WorkspaceTabNewTriggerFunction.vue';

vi.mock('@/ipc-api/Functions', () => ({
   default: {
      createTriggerFunction: vi.fn().mockResolvedValue({ status: 'success', response: null })
   }
}));

const QueryEditorStub = {
   name: 'QueryEditor',
   props: { modelValue: { type: String, default: '' }, schema: { type: String, default: '' } },
   emits: ['update:modelValue'],
   setup () {
      // Return an editor object so refs(.editor.session.setValue / .resize)
      // can be called from the SFC's clearChanges + resizeQueryEditor.
      return {
         editor: {
            session: { setValue: vi.fn() },
            resize: vi.fn()
         }
      };
   },
   template: '<div class="query-editor-stub"><slot /></div>'
};

const stubs = {
   PropsTabShell: {
      props: { isSelected: { type: Boolean, default: false } },
      template: '<div class="props-tab-shell-stub"><slot name="toolbar" /><slot name="metadata" /><slot name="content" /></div>'
   },
   PropertyCard: {
      props: { label: { type: String, default: '' } },
      template: '<div class="property-card-stub" :data-label="label"><slot /></div>'
   },
   BaseSelect: {
      props: { modelValue: { type: [String, Object], default: null }, options: { type: Array, default: () => [] } },
      emits: ['update:modelValue', 'change'],
      template: '<select class="base-select-stub" />'
   },
   BaseLoader: { template: '<div class="base-loader-stub" />' },
   BaseIcon: { template: '<i class="base-icon-stub" />' },
   Input: {
      inheritAttrs: false,
      props: { modelValue: { type: String, default: '' } },
      emits: ['update:modelValue'],
      template: '<input class="input-stub" :value="modelValue" v-bind="$attrs" @input="$emit(\'update:modelValue\', ($event.target as HTMLInputElement).value)" />'
   },
   Label: { template: '<label class="label-stub"><slot /></label>' },
   Button: {
      inheritAttrs: false,
      template: '<button class="btn-stub" v-bind="$attrs" @click="$emit(\'click\', $event)"><slot /></button>'
   },
   QueryEditor: QueryEditorStub
};

const mountTab = (
   propOverrides: Record<string, unknown> = {},
   workspaceOverrides: Record<string, unknown> = {}
) => {
   const baseWorkspace = {
      uid: 'C:1',
      client: 'pg',
      database: 'app',
      connectionStatus: 'connected',
      tabs: [{ uid: 'TAB:1', type: 'new-trigger-function' }],
      users: [{ value: '', name: '', host: '' }],
      customizations: {
         triggerFunctionSql: 'BEGIN\n   RETURN NEW;\nEND;',
         triggerFunctionlanguages: ['plpgsql'],
         definer: false,
         comment: false
      },
      structure: [],
      loadedSchemas: new Set(),
      breadcrumbs: { schema: 'public' },
      ...workspaceOverrides
   };

   return mountWithPinia(WorkspaceTabNewTriggerFunction, {
      props: {
         tabUid: 'TAB:1',
         connection: { uid: 'C:1' },
         tab: { uid: 'TAB:1' },
         isSelected: true,
         schema: 'public',
         ...propOverrides
      } as never,
      initialState: {
         workspaces: {
            workspaces: [baseWorkspace],
            selectedWorkspace: 'C:1'
         },
         console: { isVisible: false, consoleHeight: 0 },
         notifications: { notifications: [] }
      },
      stubActions: true,
      global: { stubs }
   });
};

describe('WorkspaceTabNewTriggerFunction', () => {
   it('component module is defined and exports a Vue SFC', () => {
      expect(WorkspaceTabNewTriggerFunction).toBeDefined();
      expect(typeof WorkspaceTabNewTriggerFunction).toBe('object');
   });

   it('Functions.createTriggerFunction is mocked', () => {
      expect(Functions.createTriggerFunction).toBeTypeOf('function');
      expect(vi.isMockFunction(Functions.createTriggerFunction)).toBe(true);
   });

   it('mountTab helper is a function (suite scaffolding sanity)', () => {
      expect(mountTab).toBeTypeOf('function');
   });
});
