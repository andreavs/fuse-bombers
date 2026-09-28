/**
 * The input hub: every physical one-button device (a keyboard key, a gamepad, a touch zone) reports presses here
 * under a stable device id, and the hub turns them into what the rest of the app needs:
 *
 * - `onPress` — "device X pressed", for the lobby to join players (fires for bound and unbound devices alike).
 * - `bind`/`unbind` — which device plays in which player slot.
 * - `takePresses` — per-slot "pressed since the last take" booleans for the engine's fixed step.
 *
 * Presses are latched until taken, so a tap between two engine steps is never lost, and several engine steps in one
 * frame see it only once. The hub knows nothing about browsers; the device sources in this folder feed it.
 */

/** `key:<name>` for a keyboard binding, `pad:<index>` for a gamepad, `touch:<zone>` for a touch zone. */
export type DeviceId = `key:${string}` | `pad:${number}` | `touch:${number}`;

/** A short on-screen name for a device: `Q`, `ARROWS`, `PAD 1`, `TOUCH 2`. */
export function deviceLabel(device: DeviceId): string {
  const [kind, name = ""] = device.split(":");
  if (kind === "key") return name;
  return `${kind === "pad" ? "PAD" : "TOUCH"} ${Number(name) + 1}`;
}

/** A device source attached to the hub: polled once per frame (gamepads) and disposed with the hub. */
export interface InputSource {
  poll?(): void;
  dispose?(): void;
}

export type PressListener = (device: DeviceId) => void;

export class InputHub {
  private readonly listeners = new Set<PressListener>();
  private readonly sources: InputSource[] = [];
  private readonly slotDevices = new Map<number, DeviceId>();
  private readonly pending = new Set<DeviceId>();

  /**
   * `onListenerError` receives what a press listener throws. Each listener is called on its own, so one failing
   * listener neither stops the others nor unwinds into the device source that reported the press.
   */
  constructor(
    private readonly onListenerError: (error: unknown) => void = (error) =>
      console.error("Input press listener failed", error),
  ) {}

  /** Report one press of `device`. Device sources call this; tests and bots may too. */
  press(device: DeviceId): void {
    this.pending.add(device);
    for (const listener of [...this.listeners]) {
      try {
        listener(device);
      } catch (error) {
        this.onListenerError(error);
      }
    }
  }

  /** Listen for presses of any device. Returns the unsubscribe function. */
  onPress(listener: PressListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  addSource(source: InputSource): void {
    this.sources.push(source);
  }

  /** Sample polled devices (gamepads). Call once per frame, before `takePresses`. */
  poll(): void {
    for (const source of this.sources) source.poll?.();
  }

  /**
   * Seat `device` in `slot`, moving it out of any slot it held and replacing the slot's previous device. The press
   * that caused the join is dropped, so it does not also fire the player's first shot.
   */
  bind(slot: number, device: DeviceId): void {
    const previous = this.slotOf(device);
    if (previous !== undefined) this.slotDevices.delete(previous);
    this.slotDevices.set(slot, device);
    this.pending.delete(device);
  }

  unbind(slot: number): void {
    this.slotDevices.delete(slot);
  }

  deviceOf(slot: number): DeviceId | undefined {
    return this.slotDevices.get(slot);
  }

  slotOf(device: DeviceId): number | undefined {
    for (const [slot, bound] of this.slotDevices)
      if (bound === device) return slot;
    return undefined;
  }

  /** Every bound slot and its device, in slot order. */
  bindings(): { slot: number; device: DeviceId }[] {
    return [...this.slotDevices]
      .map(([slot, device]) => ({ slot, device }))
      .sort((a, b) => a.slot - b.slot);
  }

  /**
   * One engine step's input: `result[slot]` is true when the slot's device was pressed since the previous take.
   * Clears every latched press, bound or not. Unbound slots (bots) are always false.
   */
  takePresses(slotCount: number): boolean[] {
    const pressed = Array.from({ length: slotCount }, (_, slot) => {
      const device = this.slotDevices.get(slot);
      return device !== undefined && this.pending.has(device);
    });
    this.pending.clear();
    return pressed;
  }

  /** Drop latched presses, e.g. when a match starts, so lobby presses do not leak into the first step. */
  clearPresses(): void {
    this.pending.clear();
  }

  dispose(): void {
    for (const source of this.sources.splice(0)) source.dispose?.();
    this.listeners.clear();
    this.pending.clear();
  }
}
