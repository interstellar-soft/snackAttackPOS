interface SerialPortOpenOptions {
  baudRate: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd';
  bufferSize?: number;
  flowControl?: 'none' | 'hardware';
}

type SerialPortFilter = {
  usbVendorId?: number;
  usbProductId?: number;
};

type SerialPortRequestOptions = {
  filters?: SerialPortFilter[];
};

declare interface SerialPort {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  open(options: SerialPortOpenOptions): Promise<void>;
  close(): Promise<void>;
}

declare interface Serial {
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
  addEventListener(type: 'connect' | 'disconnect', listener: (event: SerialConnectionEvent) => void, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: 'connect' | 'disconnect', listener: (event: SerialConnectionEvent) => void, options?: boolean | EventListenerOptions): void;
}

declare interface SerialConnectionEvent extends Event {
  readonly port: SerialPort;
}

declare global {
  interface Navigator {
    serial?: Serial;
  }
}

export {};
