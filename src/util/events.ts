type Listener = (...args: any[]) => void;

type ListenerArgs<T> = T extends Listener ? Parameters<T> : never;

export interface ListenerMap {
  [key: string]: Listener;
}

export class EventEmitter<E extends ListenerMap> {
  private events = new Map<keyof E, Set<E[keyof E]>>();

  public on<T extends keyof E>(type: T, listener: E[T]) {
    const { events } = this;
    const listeners = events.get(type);

    if (listeners) {
      listeners.add(listener);
    } else {
      events.set(type, new Set([listener]));
    }
  }

  public off<T extends keyof E>(type: T, listener: E[T]) {
    this.events.get(type)?.delete(listener);
  }

  public emit<T extends keyof E>(type: T, ...args: ListenerArgs<E[T]>) {
    this.events.get(type)?.forEach((listener: Listener) => listener(...args));
  }
}
