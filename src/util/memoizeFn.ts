import { Descriptor } from "./Descriptor";
import { log } from "./log";

export const memoizeFn = <Args extends any[]>({
  timeout,
  mark = "",
  validateArgs,
}: {
  timeout: number;
  mark?: string;
  validateArgs?: (...args: Args) => boolean;
}) => {
  let count = 0;
  return function (...args) {
    const $count = ++count;
    const { descriptor, key } = args[0] as Descriptor<any>;
    const method = descriptor.value;
    log?.debug(`[Memoize]`, `[${mark}]`, $count, `Decorating`);

    let lastResult;
    let lastTime;

    const wrapped = function (this, ...args: Args) {
      const now = Date.now();
      if (!lastTime || now - lastTime > timeout || validateArgs?.(...args)) {
        log.debug(`[Memoize]`, `[${mark}]`, $count, `Calling`);
        lastTime = now;
        lastResult = method.call(this, ...args);

        // invalidate cache on rejection of promise
        Promise.resolve(lastResult)
          .then(() => {
            log.debug(`[Memoize]`, `[${mark}]`, $count, `Updated cache`);
          })
          .catch(() => {
            lastTime = undefined;
          });
      } else {
        log.debug(`[Memoize]`, `[${mark}]`, $count, `Using cached`);
      }
      return lastResult;
    };
    Object.defineProperty(wrapped, "name", { value: `memoized(${key})` });

    descriptor.value = wrapped;
  };
};
