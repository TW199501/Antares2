let useTauri = false;
let tauriFs: any = null;

const STORE_PREFIX = 'antares_';

export async function loadStore<T> (name: string, defaults: T): Promise<T> {
   // Always try localStorage (works in both browser and Tauri)
   try {
      const stored = localStorage.getItem(`${STORE_PREFIX}${name}`);
      if (stored) return { ...defaults, ...JSON.parse(stored) };
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
