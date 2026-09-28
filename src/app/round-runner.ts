import {
  createMatch,
  createRound,
  nextRoundConfig,
  recordRoundResult,
  step,
  TICK_HZ,
  view,
  type MatchState,
  type RoundState,
  type RoundView,
  type TickEvent,
  type Tuning,
} from "../engine/index.js";
import type { Bot } from "./bot.js";

/** Human presses per slot, e.g. the `InputHub`. */
export interface PressSource {
  poll?(): void;
  takePresses(slotCount: number): boolean[];
}

export interface RoundRunnerOptions {
  seed: number;
  /** One entry per player: its bot, or null for a human whose presses come from `input`. */
  controllers: readonly (Bot | null)[];
  input?: PressSource;
  /** Round wins needed to take the match (default 3). */
  winsToWin?: number;
  /**
   * Seconds the aftermath of a finished round plays before the next round starts (default 4). `Infinity` holds
   * the finished round until `nextRound()` is called, for a match flow with its own results screen.
   */
  aftermath?: number;
  tuning?: Partial<Tuning>;
}

const STEP_MS = 1000 / TICK_HZ;
/** After a stall (background tab, debugger) drop time instead of fast-forwarding through it. */
const MAX_STEPS_PER_FRAME = 6;

/**
 * The app's game loop: advances the engine at a fixed 60 Hz from real frame times, asks bots and the input hub
 * for presses every step, records each finished round in `match` as soon as it ends, and starts the next round
 * (then a new match) once the aftermath has played. It implements the render layer's `RoundSource`.
 */
export class RoundRunner {
  match: MatchState;
  private state: RoundState;
  private carry = 0;
  private ticksOver = 0;
  private readonly aftermathTicks: number;

  constructor(private readonly options: RoundRunnerOptions) {
    this.aftermathTicks = Math.round((options.aftermath ?? 4) * TICK_HZ);
    this.match = this.newMatch(options.seed);
    this.state = createRound(nextRoundConfig(this.match));
  }

  /** The current round; a new object once the next round starts. */
  get view(): RoundView {
    return view(this.state);
  }

  /** Runs every whole step that `deltaMs` of real time covers and returns all their events, in order. */
  advance(deltaMs: number): TickEvent[] {
    this.options.input?.poll?.();
    this.carry = Math.min(
      this.carry + Math.max(0, deltaMs),
      MAX_STEPS_PER_FRAME * STEP_MS,
    );
    const events: TickEvent[] = [];
    while (this.carry >= STEP_MS) {
      this.carry -= STEP_MS;
      for (const event of this.tick()) events.push(event);
    }
    return events;
  }

  private tick(): readonly TickEvent[] {
    if (this.state.result && ++this.ticksOver > this.aftermathTicks)
      this.nextRound();
    const { controllers, input } = this.options;
    const humans = input?.takePresses(controllers.length) ?? [];
    const round = view(this.state);
    const pressed = controllers.map((bot, id) =>
      bot ? bot(round, id) : humans[id] === true,
    );
    const events = step(this.state, pressed);
    for (const event of events)
      if (event.type === "round-over")
        recordRoundResult(this.match, event.result);
    return events;
  }

  /** Starts the next round of the match, or of a new match once this one has a winner. */
  nextRound(): void {
    if (this.match.winner !== null)
      this.match = this.newMatch(this.match.config.seed + 1);
    this.state = createRound(nextRoundConfig(this.match));
    this.ticksOver = 0;
  }

  private newMatch(seed: number): MatchState {
    const { controllers, tuning, winsToWin } = this.options;
    const playerCount = controllers.length;
    return createMatch({ seed, playerCount, tuning, winsToWin });
  }
}
