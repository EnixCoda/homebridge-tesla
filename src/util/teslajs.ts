declare module "teslajs" {
  // exports object `promises`
  export const promises: {
    [key: string]: (...args: any[]) => Promise<any>;
  };
}
