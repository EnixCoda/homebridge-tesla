import { Descriptor } from "./Descriptor";
import { log } from "./log";
import { wait } from "./wait";

type LockKey = string;
export type UnlockFunction = () => void;

const locks: Map<LockKey, Promise<void>> = new Map();

const lockFn = <Args extends any[], R>(key: string, timeout: number, fn: (...args: Args) => R) => {
  const wrapped = async function <T>(this: T, ...args: Args) {
    const unlock = await acquireLockWithinTime(key, timeout);

    try {
      return fn.call(this, ...args);
    } finally {
      unlock();
    }
  };
  Object.defineProperty(wrapped, "name", { value: `locked(${key})` });

  return wrapped;
};

export const withLock =
  (key: string, timeout: number) =>
  (...args: any[]) => {
    const descriptor = args[0] as Descriptor<any>;
    log?.debug(`[with lock]`, `Decorating "${descriptor.key}"`);

    const method = descriptor.descriptor.value;
    descriptor.descriptor.value = lockFn(key, timeout, method);
  };

let count = 0;
async function acquireLockWithinTime(lockKey: LockKey, timeout: number): Promise<UnlockFunction> {
  const $count = ++count;
  log.debug(`[Lock]`, lockKey, $count, `Locking`);

  const lastLock = locks.get(lockKey);

  let resolve: (value: void) => void;
  const lock = new Promise<void>((res) => {
    resolve = res;
  });
  locks.set(lockKey, lock);

  if (lastLock) {
    let lastLockResolved = false;
    await Promise.race([
      wait(timeout).then(() => {
        if (lastLockResolved) return;

        log.debug(`[Lock]`, lockKey, $count, `Timed out`);
        unlock(); // force unlocking not acquired lock so that the next pending acquirement can acquire the lock
        throw new Error("Timed out waiting for lock");
      }),
      lastLock.then(() => {
        lastLockResolved = true;
      }),
    ]).then(() => {
      log.debug(`[Lock]`, lockKey, $count, `Released`);
    });
  }

  log.debug(`[Lock]`, lockKey, $count, `Acquired`);

  const unlock = () => {
    log.debug(`[Lock]`, lockKey, $count, `Unlocking`);
    if (locks.get(lockKey) === lock) {
      log.debug(`[Lock]`, lockKey, $count, `Lock is the last one`);
    }
    resolve(undefined);
  };

  return unlock;
}
