import "@testing-library/jest-dom/vitest";

/**
 * jsdom nao implementa Pointer Events. Sem `PointerEvent`, o `fireEvent` do
 * testing-library cai para `Event`, que descarta `clientX`/`clientY` — e o
 * arraste no campo depende exatamente dessas coordenadas. `MouseEvent` carrega
 * as duas, entao serve de base para o polyfill.
 */
if (typeof window !== "undefined" && !("PointerEvent" in window)) {
  class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    readonly isPrimary: boolean;

    constructor(tipo: string, init: PointerEventInit = {}) {
      super(tipo, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? "mouse";
      this.isPrimary = init.isPrimary ?? true;
    }
  }

  Object.defineProperty(window, "PointerEvent", {
    writable: true,
    configurable: true,
    value: PointerEventPolyfill,
  });
}

// Captura de ponteiro tambem nao existe no jsdom.
for (const metodo of [
  "setPointerCapture",
  "releasePointerCapture",
  "hasPointerCapture",
] as const) {
  if (!(metodo in Element.prototype)) {
    Object.defineProperty(Element.prototype, metodo, {
      writable: true,
      configurable: true,
      value: () => undefined,
    });
  }
}
