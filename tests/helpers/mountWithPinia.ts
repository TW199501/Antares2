import { createTestingPinia } from '@pinia/testing';
import { mount, type MountingOptions } from '@vue/test-utils';
import { vi } from 'vitest';
import type { Component } from 'vue';

export interface MountWithPiniaOptions<T>
   extends Omit<MountingOptions<T>, 'global'> {
   /** Seed Pinia store(s) initial state — keyed by store id */
   initialState?: Record<string, unknown>;
   /** When true, actions are replaced by spies that don't mutate state */
   stubActions?: boolean;
   /** Forwarded to MountingOptions['global'] (plugins / provide / mocks) */
   global?: MountingOptions<T>['global'];
}

export function mountWithPinia<T extends Component> (
   component: T,
   options: MountWithPiniaOptions<T> = {}
) {
   const { initialState, stubActions = false, global, ...rest } = options;

   const pinia = createTestingPinia({
      initialState,
      stubActions,
      createSpy: vi.fn
   });

   return mount(component, {
      ...rest,
      global: {
         ...global,
         plugins: [pinia, ...(global?.plugins ?? [])]
      }
   });
}
