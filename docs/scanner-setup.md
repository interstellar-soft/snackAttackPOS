# Connecting a barcode scanner to Aurora POS

Aurora POS can talk directly to USB barcode scanners that expose a serial (COM) interface through the browser's [Web Serial API](https://developer.mozilla.org/docs/Web/API/Web_Serial_API). Follow the steps below to pair a scanner with the POS screen.

## 1. Use a compatible browser or desktop build

The serial integration relies on Web Serial, which is available in Chromium-based browsers (Chrome, Edge, Opera) and in the packaged desktop app. Safari and Firefox do not expose Web Serial yet, so the **Connect scanner** button will stay disabled and you will see the "Direct scanner connection is not supported in this browser" status message.

## 2. Plug in and test the scanner

1. Connect the USB cable from the scanner to your workstation. Most handheld scanners ship in HID (keyboard emulation) mode by default; to use serial mode, switch the scanner to **USB CDC / Virtual COM Port** using the vendor's configuration barcodes.
2. Open the scanner's manual and ensure the baud rate is set to **9600 bps**, **8 data bits**, **no parity**, **1 stop bit** (the defaults expected by Aurora POS). Adjust the settings if your model uses different defaults.
3. On Windows, confirm the scanner appears in **Device Manager → Ports (COM & LPT)**. On macOS/Linux, run `ls /dev/tty.*` or `ls /dev/ttyUSB*` to verify the port name.

## 3. Connect from the POS screen

1. Sign in to Aurora POS and navigate to the **POS** or **Purchases** screen.
2. Click the **Connect scanner** button next to the barcode input.
3. Your browser will open a native device picker listing available serial devices. Select the scanner's port and press **Connect**.
4. Aurora POS opens the port at 9600 bps, starts reading lines, and shows **Scanner connected** under the button once the handshake succeeds.
5. Scan a barcode—the digits should populate in the input automatically, and the matching product will be pulled into the cart.

## 4. Disconnecting and troubleshooting

- To unplug or switch scanners, click **Disconnect scanner** first so the port is released cleanly.
- If you see a "Scanner error" banner, click **Disconnect scanner**, unplug/replug the device, and try **Connect scanner** again. The log message shows the underlying serial error text reported by the browser.
- Aurora POS automatically reconnects to the last granted port on page load. If the scanner is not present, you will see the **Scanner idle** status—click **Connect scanner** to choose a new device.

These steps mirror the logic implemented in `useSerialBarcodeScanner`, which requests a serial port, opens it at 9600 bps, and streams newline-delimited scans into the POS input field.
