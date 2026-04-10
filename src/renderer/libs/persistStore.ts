let useTauri = false;
let tauriFs: any = null;

// Try to detect Tauri environment
try {
   if ((window as any).__TAURI_INTERNALS__) {
      useTauri = true;
   }
}
catch {}

const STORE_PREFIX = 'antares_';

export async function loadStore<T> (name: string, defaults: T): Promise<T> {
   try {
      if (useTauri && tauriFs) {
         const { BaseDirectory, readTextFile } = tauriFs;
         const text = await readTextFile(`antares-data/${name}.json`, { baseDir: BaseDirectory.AppData });
         return { ...defaults, ...JSON.parse(text) };
      }
      else {
         // Fallback: localStorage
         const stored = localStorage.getItem(`${STORE_PREFIX}${name}`);
         if (stored) return { ...defaults, ...JSON.parse(stored) };
         return defaults;
      }
   }
   catch {
      return defaults;
   }
}

export async function saveStore (name: string, data: unknown): Promise<void> {
   try {
      if (useTauri && tauriFs) {
         const { BaseDirectory, writeTextFile, exists, mkdir } = tauriFs;
         const dirExists = await exists('antares-data', { baseDir: BaseDirectory.AppData });
         if (!dirExists) await mkdir('antares-data', { baseDir: BaseDirectory.AppData, recursive: true });
         await writeTextFile(`antares-data/${name}.json`, JSON.stringify(data, null, 2), { baseDir: BaseDirectory.AppData });
      }
      else {
         localStorage.setItem(`${STORE_PREFIX}${name}`, JSON.stringify(data));
      }
   }
   catch (err) {
      console.error(`Failed to save store "${name}":`, err);
   }
}

export async function initTauriFs (): Promise<void> {
   try {
      tauriFs = await import('@tauri-apps/plugin-fs');
      useTauri = true;
   }
   catch {
      useTauri = false;
   }
}
