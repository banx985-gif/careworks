// Milestone 35: the one-time move of saves kept in localStorage before IndexedDB became the main store. A phone with no
// IndexedDB saved under 'careworks:<key>'; from Milestone 35 the store is IndexedDB with localStorage behind it under
// its own prefix (core FallbackAdapter). Every old key is copied into the store only where the store has nothing for it,
// read back and compared; the old copies are left exactly as they were. The settings' quick copy is not a save and is
// skipped. The move is marked done in the store, so it runs once.
//   moveOldLocalSaves({ adapter, oldPrefix, newPrefix, marker, skip, storage }) → { already, moved: [keys], failed: [keys] }
export async function moveOldLocalSaves({ adapter, oldPrefix, newPrefix, marker, skip = [], storage = globalThis.localStorage ?? null }) {
  try {
    if ((await adapter.get(marker))?.done) return { already: true, moved: [], failed: [] };
  } catch {
    return { already: false, moved: [], failed: [], error: 'store unreadable' };
  }
  const keys = [];
  try {
    for (let i = 0; i < (storage?.length ?? 0); i++) {
      const k = storage.key(i);
      if (!k || !k.startsWith(oldPrefix) || k.startsWith(newPrefix)) continue;
      if (skip.includes(k) || k.endsWith('__probe')) continue;
      keys.push(k);
    }
  } catch {
    /* no localStorage: nothing to move */
  }
  const moved = [];
  const failed = [];
  for (const k of keys) {
    const name = k.slice(oldPrefix.length);
    try {
      const raw = storage.getItem(k);
      if (raw == null) continue;
      const value = JSON.parse(raw);
      if ((await adapter.get(name)) != null) continue; // the store already has its own (newer) copy
      await adapter.set(name, value);
      const back = await adapter.get(name);
      if (JSON.stringify(back) !== JSON.stringify(value)) throw new Error('did not read back');
      moved.push(name);
    } catch {
      failed.push(name);
    }
  }
  if (!failed.length) await adapter.set(marker, { done: true, at: Date.now(), moved });
  return { already: false, moved, failed };
}
