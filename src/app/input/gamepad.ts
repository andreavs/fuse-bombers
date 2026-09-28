import type { DeviceId, InputSource } from "./hub.js";

/** The part of a `Gamepad` the gamepad source reads. */
export interface GamepadLike {
  readonly index: number;
  readonly connected: boolean;
  readonly mapping: string;
  readonly buttons: readonly {
    readonly pressed: boolean;
    readonly value: number;
  }[];
}

/** `navigator.getGamepads` in the browser, a fake in tests. */
export type GetGamepads = () => readonly (GamepadLike | null)[];

/** In the standard mapping buttons 0–3 are the face buttons (A B X Y); an unmapped pad has no known layout. */
const FACE_BUTTONS = 4;

function faceButtonDown(pad: GamepadLike): boolean {
  const buttons =
    pad.mapping === "standard"
      ? pad.buttons.slice(0, FACE_BUTTONS)
      : pad.buttons;
  return buttons.some((button) => button.pressed || button.value > 0.5);
}

/**
 * Gamepad N is the device `pad:N`, and any face button is its one button. The Gamepad API has no button events, so
 * this polls: a press is a poll where some face button is down and none was at the previous poll. Hot-plugging
 * needs no events either: a pad is simply present or absent in `getGamepads()`, and a pad that comes back at the
 * same index is the same device (so an unplugged player can reconnect).
 */
export function attachGamepads(
  getGamepads: GetGamepads,
  press: (device: DeviceId) => void,
): InputSource {
  const down = new Map<number, boolean>();
  return {
    poll: () => {
      const present = new Set<number>();
      for (const pad of getGamepads()) {
        if (!pad?.connected) continue;
        present.add(pad.index);
        const isDown = faceButtonDown(pad);
        if (isDown && !down.get(pad.index)) press(`pad:${pad.index}`);
        down.set(pad.index, isDown);
      }
      for (const index of down.keys())
        if (!present.has(index)) down.delete(index);
    },
  };
}
