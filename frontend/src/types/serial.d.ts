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

interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
  bluetoothServiceClassId?: number;
  bluetoothVendorId?: number;
  bluetoothProductId?: number;
  bluetoothVendorIdSource?: number;
  serialNumber?: string;
  manufacturer?: string;
  productName?: string;
  portId?: string;
  path?: string;
  name?: string;
  [key: string]: unknown;
}

declare interface SerialPort {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  open(options: SerialPortOpenOptions): Promise<void>;
  close(): Promise<void>;
  getInfo?(): SerialPortInfo | undefined;
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
