/** Serializes saves and keeps edits made during an in-flight request pending. */
export function createPendingSave<T>(save: (data: T) => Promise<void>) {
  let revision = 0;
  let savedRevision = 0;
  let latest: T;
  let running: Promise<void> | null = null;
  return {
    edit(data: T) { latest = data; revision++; },
    get revision() { return revision; },
    get dirty() { return revision !== savedRevision; },
    get saving() { return running !== null; },
    flush(): Promise<void> {
      if (running) return running;
      if (revision === savedRevision) return Promise.resolve();
      running = (async () => {
        while (revision !== savedRevision) {
          const snapshot = revision;
          await save(latest);
          savedRevision = snapshot;
        }
      })().finally(() => { running = null; });
      return running;
    },
  };
}