const EventEmitter = require("events-async");

export class SyncHook {
  eventEmitter: any;
  name: string;

  constructor() {
    const eventEmitter = new EventEmitter();
    this.eventEmitter = eventEmitter;
    this.name = "";
  }
  tap(name: string, fn: (data: any) => void) {
    this.name = name;

    this.eventEmitter.on(name, fn);
  }

  call(data: any) {
    this.eventEmitter.emit(this.name, data);
  }
}

export class AsyncHook {
  eventEmitter: any;
  name: string;

  constructor() {
    const eventEmitter = new EventEmitter();
    this.eventEmitter = eventEmitter;
    this.name = "";
  }
  tapAsync(name: string, fn: (data: any) => void) {
    this.name = name;

    this.eventEmitter.on(name, fn);
  }

  tapPromise(name: string, fn: (data: any) => Promise<any>) {
    this.name = name;
    this.eventEmitter.on(name, fn);
  }

  callAsync(data: any, callback: (err?: any) => void) {
    if (!this.name) callback();

    try {
      this.eventEmitter.emit(this.name, data, callback);
    } catch (error) {
      callback(error);
    }
  }

  promise(data: any) {
    if (!this.name) return Promise.resolve();

    return this.eventEmitter.emit(this.name, data);
  }
}
