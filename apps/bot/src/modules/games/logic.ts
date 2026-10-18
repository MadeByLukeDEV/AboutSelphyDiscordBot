// The rules of the minigames. Pure: no Discord, no database, no clock; randomness comes in as a function so every rule is testable.

export type Rng = () => number;

// ---- rock, paper, scissors ------------------------------------------------------------------------------

export const RPS_CHOICES = ["rock", "paper", "scissors"] as const;
export type RpsChoice = (typeof RPS_CHOICES)[number];
export const RPS_EMOJI: Record<RpsChoice, string> = { rock: "🪨", paper: "📄", scissors: "✂️" };
export const isRpsChoice = (v: string): v is RpsChoice => RPS_CHOICES.includes(v as RpsChoice);

const BEATS: Record<RpsChoice, RpsChoice> = { rock: "scissors", paper: "rock", scissors: "paper" };

/** Who wins: "a", "b" or "draw". */
export function rpsOutcome(a: RpsChoice, b: RpsChoice): "a" | "b" | "draw" {
  if (a === b) return "draw";
  return BEATS[a] === b ? "a" : "b";
}

export const randomRps = (rng: Rng): RpsChoice => RPS_CHOICES[Math.floor(rng() * RPS_CHOICES.length)]!;

// ---- tic-tac-toe ----------------------------------------------------------------------------------------

export type Mark = "X" | "O";
export type Cell = Mark | "";
export type TttBoard = Cell[];

export const emptyTtt = (): TttBoard => Array<Cell>(9).fill("");

const TTT_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

/** The winning line (cell numbers) for a mark, or null. */
export function tttLine(board: TttBoard): { mark: Mark; cells: readonly number[] } | null {
  for (const line of TTT_LINES) {
    const [a, b, c] = line;
    const m = board[a!];
    if (m && m === board[b!] && m === board[c!]) return { mark: m, cells: line };
  }
  return null;
}

/** "X" or "O" when someone won, "draw" when the board is full, null while the game goes on. */
export function tttResult(board: TttBoard): Mark | "draw" | null {
  const line = tttLine(board);
  if (line) return line.mark;
  return board.every((c) => c !== "") ? "draw" : null;
}

/** A new board with the mark placed, or null when the cell is taken or out of range. */
export function tttPlace(board: TttBoard, index: number, mark: Mark): TttBoard | null {
  if (!Number.isInteger(index) || index < 0 || index > 8 || board[index] !== "") return null;
  const next = board.slice();
  next[index] = mark;
  return next;
}

// ---- connect four ---------------------------------------------------------------------------------------

export const C4_COLS = 7;
export const C4_ROWS = 6;
export type C4Cell = Mark | "";
/** Row 0 is the top. */
export type C4Grid = C4Cell[][];

export const emptyC4 = (): C4Grid => Array.from({ length: C4_ROWS }, () => Array<C4Cell>(C4_COLS).fill(""));

/** Drops a disc into a column. Returns the new grid and the row it landed in, or null when the column is full or invalid. */
export function c4Drop(grid: C4Grid, col: number, mark: Mark): { grid: C4Grid; row: number } | null {
  if (!Number.isInteger(col) || col < 0 || col >= C4_COLS) return null;
  for (let row = C4_ROWS - 1; row >= 0; row--) {
    if (grid[row]![col] === "") {
      const next = grid.map((r) => r.slice());
      next[row]![col] = mark;
      return { grid: next, row };
    }
  }
  return null;
}

/** Four in a row anywhere: the cells of the line, or null. */
export function c4Line(grid: C4Grid): { mark: Mark; cells: Array<[number, number]> } | null {
  const dirs: Array<[number, number]> = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let r = 0; r < C4_ROWS; r++) {
    for (let c = 0; c < C4_COLS; c++) {
      const m = grid[r]![c];
      if (!m) continue;
      for (const [dr, dc] of dirs) {
        const cells: Array<[number, number]> = [[r, c]];
        for (let k = 1; k < 4; k++) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= C4_ROWS || cc < 0 || cc >= C4_COLS || grid[rr]![cc] !== m) break;
          cells.push([rr, cc]);
        }
        if (cells.length === 4) return { mark: m, cells };
      }
    }
  }
  return null;
}

export function c4Result(grid: C4Grid): Mark | "draw" | null {
  const line = c4Line(grid);
  if (line) return line.mark;
  return grid[0]!.every((c) => c !== "") ? "draw" : null;
}

// ---- trivia ---------------------------------------------------------------------------------------------

export type TriviaQuestion = { q: string; a: [string, string, string, string]; cat: string };
export type TriviaRound = { question: string; category: string; options: string[]; correct: number };

/** A random question not asked recently, with its four answers in random order (the first listed answer is always the right one in the bank). */
export function triviaRound(bank: readonly TriviaQuestion[], recent: ReadonlySet<number>, rng: Rng): { index: number; round: TriviaRound } {
  const pool = bank.map((_, i) => i).filter((i) => !recent.has(i));
  const choices = pool.length > 0 ? pool : bank.map((_, i) => i);
  const index = choices[Math.floor(rng() * choices.length)]!;
  const item = bank[index]!;
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return { index, round: { question: item.q, category: item.cat, options: order.map((o) => item.a[o]!), correct: order.indexOf(0) } };
}

// ---- the instant games ----------------------------------------------------------------------------------

export const coinflip = (rng: Rng): "heads" | "tails" => (rng() < 0.5 ? "heads" : "tails");

/** A die with `sides` sides (2-1000). */
export function rollDie(sides: number, rng: Rng): number {
  const n = Math.min(1000, Math.max(2, Math.trunc(sides)));
  return Math.floor(rng() * n) + 1;
}

export const EIGHT_BALL = [
  "It is certain.",
  "Without a doubt.",
  "Yes, definitely.",
  "You may rely on it.",
  "As I see it, yes.",
  "Most likely.",
  "Signs point to yes.",
  "Reply hazy, try again.",
  "Ask again later.",
  "Better not tell you now.",
  "Cannot predict now.",
  "Concentrate and ask again.",
  "Don't count on it.",
  "My reply is no.",
  "My sources say no.",
  "Outlook not so good.",
  "Very doubtful.",
] as const;

export const eightBall = (rng: Rng): string => EIGHT_BALL[Math.floor(rng() * EIGHT_BALL.length)]!;

// ---- game XP --------------------------------------------------------------------------------------------

/** How much of the XP a win would give may still be granted today: never negative, never past the daily cap. */
export function grantableXp(requested: number, usedToday: number, dailyCap: number): number {
  return Math.max(0, Math.min(Math.trunc(requested), dailyCap - usedToday));
}

/** "YYYY-MM-DD" of a moment in UTC. */
export const dayKey = (now: Date): string => now.toISOString().slice(0, 10);

// ---- component ids --------------------------------------------------------------------------------------

export const GAME_PREFIX = "gm";
export type ControlKind = "t" | "c" | "r" | "q";

/** "gm:t:ab12cd34:4" (kind, game id, argument). */
export const controlId = (kind: ControlKind, id: string, arg: string | number): string => `${GAME_PREFIX}:${kind}:${id}:${arg}`;

export function parseControl(customId: string): { kind: ControlKind; id: string; arg: string } | null {
  const m = /^gm:([tcrq]):([a-z0-9]{6,12}):([a-z0-9]{1,3})$/.exec(customId);
  return m ? { kind: m[1] as ControlKind, id: m[2]!, arg: m[3]! } : null;
}

export function newGameId(rng: Rng): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 8; i++) id += alphabet[Math.floor(rng() * alphabet.length)];
  return id;
}
