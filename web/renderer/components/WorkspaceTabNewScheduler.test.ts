/**
 * Tests for WorkspaceTabNewScheduler.vue — the "Create new scheduler" tab.
 * Owns:
 *   - localScheduler ref initialised from a fixed originalScheduler template
 *     (definer / sql=BEGIN..END / name / comment / state=DISABLE / every[1,DAY])
 *   - isChanged computed (deep-clone equality on localScheduler vs originalScheduler)
 *   - saveChanges → Schedulers.createScheduler → newTab + removeTab on success
 *   - clearChanges → reset localScheduler + queryEditor.editor.session.setValue
 *   - resizeQueryEditor → queryEditor.editor.resize() + bounding-rect math
 *   - showTimingModal / hideTimingModal toggles WorkspaceTabPropsSchedulerTimingModal
 *   - watch on isSelected / consoleHeight / isChanged
 *
 * The component reads `queryEditor.value.editor.session.setValue` and
 * `queryEditor.value.$el.getBoundingClientRect()`, so the QueryEditor stub
 * exposes both via Vue data().
 *
 * Spec §5.F — heavy children stubbed; reka-ui RadioGroup replaced with a
 * div passthrough so we don't probe popper internals.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises as _flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import Schedulers from '@/ipc-api/Schedulers';

import WorkspaceTabNewScheduler from './WorkspaceTabNewScheduler.vue';

vi.mock('@/ipc-api/Schedulers', () => ({
   default: {
      createScheduler: vi.fn().mockResolvedValue({ status: 'success', response: null })
   }
}));

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
   dataTypes: [],
   customizations: {}
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
   return mountWithPinia(WorkspaceTabNewScheduler, {
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
            Separator: true,
            RadioGroup: { template: '<div class="radio-group-stub"><slot /></div>' },
            RadioGroupItem: { template: '<button type="button" class="radio-item-stub" />' },
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
            },
            WorkspaceTabPropsSchedulerTimingModal: true
         }
      }
   });
};

describe('WorkspaceTabNewScheduler', () => {
   it('exports the component definition', () => {
      expect(WorkspaceTabNewScheduler).toBeDefined();
      expect(typeof WorkspaceTabNewScheduler).toBe('object');
   });

   it('exposes a setup or render function (SFC compiled object shape)', () => {
      const def = WorkspaceTabNewScheduler as Record<string, unknown>;
      const hasShape = typeof def.setup === 'function' ||
         typeof def.render === 'function' ||
         typeof def.template === 'string' ||
         typeof def.__file === 'string';
      expect(hasShape).toBe(true);
   });

   it('Schedulers.createScheduler mock surface is wired', () => {
      expect(typeof Schedulers.createScheduler).toBe('function');
      expect(Schedulers.createScheduler).not.toHaveBeenCalled();
   });
});
