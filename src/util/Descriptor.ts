export type Descriptor<T> =
  | {
      kind: "method";
      key: string;
      placement: "prototype" | "own";
      descriptor: {
        value: T & ((...args: any[]) => any);
        writable: boolean;
        configurable: boolean;
        enumerable: boolean;
      };
    }
  | {
      kind: "field";
      key: string;
      placement: "prototype" | "own";
      descriptor: {
        value: T;
        writable: boolean;
        configurable: boolean;
        enumerable: boolean;
      };
    };
