import type { DeviceId, InputSource } from "./hub.js";

/**
 * Six player buttons spread across a keyboard so six people can crowd round one laptop: two on the left hand side
 * (`Q` top-left, `C` bottom-left), two on the right (`M` bottom-right, `P` top-right), then the arrow cluster and
 * the numpad for players at the far right. Any arrow key is the ARROWS button, and `Numpad0` or `NumpadEnter` is
 * the NUM0 button, so those players do not have to find one small key. Codes are layout-independent
 * (`KeyboardEvent.code`), so `Q` is the top-left letter key on AZERTY too.
 */
export const KEY_BINDINGS: readonly {
  readonly device: DeviceId;
  readonly codes: readonly string[];
}[] = [
  { device: "key:Q", codes: ["KeyQ"] },
  { device: "key:C", codes: ["KeyC"] },
  { device: "key:M", codes: ["KeyM"] },
  { device: "key:P", codes: ["KeyP"] },
  {
    device: "key:ARROWS",
    codes: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"],
  },
  { device: "key:NUM0", codes: ["Numpad0", "NumpadEnter"] },
];

/** The part of a `KeyboardEvent` the keyboard source reads. */
export type KeyEventLike = Pick<
  KeyboardEvent,
  "code" | "repeat" | "ctrlKey" | "metaKey" | "altKey" | "preventDefault"
>;

/** Where key events come from: `window` in the browser, a fake in tests. */
export interface KeyboardTarget {
  addEventListener(
    type: "keydown" | "keyup",
    listener: (event: KeyEventLike) => void,
  ): void;
  addEventListener(type: "blur", listener: () => void): void;
  removeEventListener(
    type: "keydown" | "keyup",
    listener: (event: KeyEventLike) => void,
  ): void;
  removeEventListener(type: "blur", listener: () => void): void;
}

/**
 * Report a press when a bound key goes down. Auto-repeat is ignored (both `event.repeat` and a second keydown
 * without a keyup), and while one key of a binding is held its other keys do not press again. Shortcuts with
 * Ctrl, Cmd or Alt are left to the browser.
 */
export function attachKeyboard(
  target: KeyboardTarget,
  press: (device: DeviceId) => void,
): InputSource {
  const bindingOf = new Map(
    KEY_BINDINGS.flatMap((binding) =>
      binding.codes.map((code) => [code, binding] as const),
    ),
  );
  const held = new Set<string>();

  const onKeyDown = (event: KeyEventLike): void => {
    const binding = bindingOf.get(event.code);
    if (!binding || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault(); // Arrow keys would scroll, and the game owns these keys.
    if (event.repeat || held.has(event.code)) return;
    const bindingHeld = binding.codes.some((code) => held.has(code));
    held.add(event.code);
    if (!bindingHeld) press(binding.device);
  };
  const onKeyUp = (event: KeyEventLike): void => {
    held.delete(event.code);
  };
  // Keyups are lost while the window is unfocused; forget held keys so they press again on return.
  const onBlur = (): void => held.clear();

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", onBlur);
  return {
    dispose: () => {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("blur", onBlur);
    },
  };
}
