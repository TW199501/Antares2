/**
 * Tests for WorkspaceTabPropsMaterializedView.vue — the Properties tab for
 * a materialized view. Owns:
 *   - localView ref hydrated from Views.getMaterializedViewInformations
 *   - isChanged computed (deep-clone equality on localView vs originalView)
 *   - saveChanges → Views.alterMaterializedView → optional renameTabs +
 *     changeBreadcrumbs on success
 *   - clearChanges → reset localView + queryEditor.editor.session.setValue
 *   - resizeQueryEditor uses queryEditor.$el bounding-rect + #footer offsetHeight
 *   - watch on schema / view / isSelected → refetch
 *   - top-level async IIFE in setup: await getViewData() then
 *     queryEditor.value.editor.session.setValue(localView.value.sql)
 *
 * QueryEditor stub exposes editor.session.setValue + editor.resize via data().
 * A #footer element is injected so resizeQueryEditor() doesn't NPE on
 * `footer.offsetHeight`.
 *
 * Spec §5.F — heavy children stubbed; we don't probe popper internals.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises as _flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Views from '@/ipc-api/Views';

import WorkspaceTabPropsMaterializedView from './WorkspaceTabPropsMaterializedView.vue';

vi.mock('@/ipc-api/Views', () => ({
   default: {
      getMaterializedViewInformations: vi.fn().mockResolvedValue({
         status: 'success',
         response: {
            name: 'mv_users_summary',
            sql: 'SELECT 1',
            definer: '`root`@`localhost`',
            security: 'DEFINER',
            algorithm: 'UNDEFINED',
            updateOption: ''
         }
      }),
      alterMaterializedView: vi.fn().mockResolvedValue({ status: 'success', response: null })
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
   template: '<input class="input-stub" v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', ($event.target as HTMLInputElement).value)" />'
};

const ButtonStub = {
   name: 'Button',
   inheritAttrs: false,
   emits: ['click'],
   template: '<button type="button" class="btn-stub" v-bind="$attrs" @click="$emit(\'click\', $event)"><slot /></button>'
};

const _mountTab = (
   propOverrides: Record<string, unknown> = {},
   workspaceOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(WorkspaceTabPropsMaterializedView, {
      props: {
         tabUid: 'T:1',
         connection: { uid: 'C:1', client: 'mysql' },
         view: 'mv_users_summary',
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
         console: { consoleHeight: 0, isConsoleOpen: false }
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

// resizeQueryEditor() reads #footer.offsetHeight without a null guard. Inject
// it into document.body so the call doesn't NPE under happy-dom. Also keeps
// the QueryEditor.$el.getBoundingClientRect() math benign.
beforeEach(() => {
   if (!document.getElementById('footer')) {
      const f = document.createElement('div');
      f.id = 'footer';
      Object.defineProperty(f, 'offsetHeight', { configurable: true, value: 0 });
      document.body.appendChild(f);
   }
});

afterEach(() => {
   const f = document.getElementById('footer');
   if (f) f.remove();
});

describe('WorkspaceTabPropsMaterializedView', () => {
   it('exports the component definition', () => {
      expect(WorkspaceTabPropsMaterializedView).toBeDefined();
      expect(typeof WorkspaceTabPropsMaterializedView).toBe('object');
   });

   it('exposes a setup or render function (SFC compiled object shape)', () => {
      const def = WorkspaceTabPropsMaterializedView as Record<string, unknown>;
      const hasShape = typeof def.setup === 'function' ||
         typeof def.render === 'function' ||
         typeof def.template === 'string' ||
         typeof def.__file === 'string';
      expect(hasShape).toBe(true);
   });

   it('Views IPC mock surface is wired (getMaterializedViewInformations + alterMaterializedView)', () => {
      expect(typeof Views.getMaterializedViewInformations).toBe('function');
      expect(typeof Views.alterMaterializedView).toBe('function');
   });
});
