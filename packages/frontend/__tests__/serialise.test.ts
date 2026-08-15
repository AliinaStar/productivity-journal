import { createSerialiser } from '@/utils/serialise';

/** A task that reads shared state, waits, then writes it back. */
function readModifyWrite(state: { rows: string[] }, log: string[]) {
  return async () => {
    const pending = [...state.rows];
    await new Promise(r => setTimeout(r, 5));
    for (const row of pending) log.push(row);
    state.rows = [];
  };
}

describe('createSerialiser', () => {
  it('runs overlapping tasks one at a time', async () => {
    const serialised = createSerialiser();
    const order: string[] = [];

    const task = (name: string) => async () => {
      order.push(`${name}:start`);
      await new Promise(r => setTimeout(r, 5));
      order.push(`${name}:end`);
    };

    await Promise.all([
      serialised(task('a')),
      serialised(task('b')),
      serialised(task('c')),
    ]);

    expect(order).toEqual([
      'a:start', 'a:end',
      'b:start', 'b:end',
      'c:start', 'c:end',
    ]);
  });

  it('stops two pushes from sending the same rows twice', async () => {
    // The actual bug: both pushes read the unsynced rows before either had
    // marked them synced, so every row was POSTed twice.
    const state = { rows: ['entry-1', 'entry-2'] };
    const sent: string[] = [];
    const serialised = createSerialiser();

    await Promise.all([
      serialised(readModifyWrite(state, sent)),
      serialised(readModifyWrite(state, sent)),
    ]);

    expect(sent).toEqual(['entry-1', 'entry-2']);
  });

  it('shows what happens without it', async () => {
    // Same two tasks unserialised — the duplicate this guards against.
    const state = { rows: ['entry-1', 'entry-2'] };
    const sent: string[] = [];

    await Promise.all([
      readModifyWrite(state, sent)(),
      readModifyWrite(state, sent)(),
    ]);

    expect(sent).toEqual(['entry-1', 'entry-2', 'entry-1', 'entry-2']);
  });

  it('does not wedge the queue when a task fails', async () => {
    const serialised = createSerialiser();
    const done: string[] = [];

    const failing = serialised(async () => {
      throw new Error('network down');
    });
    const following = serialised(async () => {
      done.push('ran');
    });

    await expect(failing).rejects.toThrow('network down');
    await following;
    expect(done).toEqual(['ran']);
  });

  it('gives each caller its own result', async () => {
    const serialised = createSerialiser();
    const results = await Promise.all([
      serialised(async () => 1),
      serialised(async () => 2),
    ]);
    expect(results).toEqual([1, 2]);
  });
});
