import { Logging } from "homebridge";

export let log: Logging;

export const setLog = (newLog: typeof log) => {
  log = newLog;
};
