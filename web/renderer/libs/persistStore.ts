const STORE_PREFIX = 'antares_';

export async function loadStore<T> (name: string, defaults: T): Promise<T> {
   try {
      const stored = localStorage.getItem(`${STORE_PREFIX}${name}`);
      if (stored) {
         const parsed = JSON.parse(stored);
         // If defaults is an array, return parsed directly (don't spread)
         if (Array.isArray(defaults)) return parsed as T;
         // If defaults is an object, merge
         if (typeof defaults === 'object' && defaults !== null) return { ...defaults, ...parsed };
         return parsed as T;
      }
      return defaults;
   }
   catch {
      return defaults;
   }
}

export async function saveStore (name: string, data: unknown): Promise<void> {
   try {
      localStorage.setItem(`${STORE_PREFIX}${name}`, JSON.stringify(data));
   }
   catch (err) {
      console.error(`Failed to save store "${name}":`, err);
   }
}

export async function initTauriFs (): Promise<void> {
   // localStorage works everywhere, no special init needed
}
