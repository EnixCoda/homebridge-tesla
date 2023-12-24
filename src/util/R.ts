// teslajs.setLogLevel(tesla.API_LOG_ALL);
export type R<T, E> =
  | {
      state: "success";
      value: T;
    }
  | {
      state: "error";
      error: E;
    };
export const r = {
  t: <T, E>(t): R<T, E> => ({
    state: "success",
    value: t,
  }),
  e: <T, E>(e): R<T, E> => ({
    state: "error",
    error: e,
  }),
};
