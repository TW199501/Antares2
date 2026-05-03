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

   // Cast to any: @vue/test-utils 2.4.x distinguishes ComponentMountingOptions<T>
   // from MountingOptions<T> via deep ComponentProps<T> inference, which our
   // pass-through Omit<MountingOptions<T>, 'global'> can't satisfy. The public
   // surface (MountWithPiniaOptions) keeps type checking at the call site —
   // only this internal mount() invocation needs the cast.
   return mount(component, {
      ...rest,
      global: {
         ...global,
         plugins: [pinia, ...(global?.plugins ?? [])]
      }
   } as Parameters<typeof mount>[1]);
}
