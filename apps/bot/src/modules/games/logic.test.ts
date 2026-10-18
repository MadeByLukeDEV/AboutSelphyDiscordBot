import { describe, expect, it } from "vitest";
import { c4Drop, c4Line, c4Result, coinflip, controlId, dayKey, eightBall, emptyC4, emptyTtt, EIGHT_BALL, grantableXp, newGameId, parseControl, randomRps, rollDie, rpsOutcome, triviaRound, tttPlace, tttResult, tttLine, type C4Grid } from "./logic";
import { TRIVIA } from "./trivia-bank";

const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe("rock, paper, scissors", () => {
  it("follows the classic rules", () => {
    expect(rpsOutcome("rock", "scissors")).toBe("a");
    expect(rpsOutcome("scissors", "rock")).toBe("b");
    expect(rpsOutcome("paper", "rock")).toBe("a");
    expect(rpsOutcome("scissors", "paper")).toBe("a");
    expect(rpsOutcome("paper", "paper")).toBe("draw");
  });
  it("picks any of the three from the rng", () => {
    expect(randomRps(() => 0)).toBe("rock");
    expect(randomRps(() => 0.99)).toBe("scissors");
  });
});

describe("tic-tac-toe", () => {
  it("places marks only on free cells", () => {
    const b = tttPlace(emptyTtt(), 4, "X")!;
    expect(b[4]).toBe("X");
    expect(tttPlace(b, 4, "O")).toBeNull();
    expect(tttPlace(b, 9, "O")).toBeNull();
    expect(tttPlace(b, -1, "O")).toBeNull();
    expect(tttPlace(b, 1.5, "O")).toBeNull();
  });
  it("finds rows, columns and diagonals", () => {
    expect(tttResult(["X", "X", "X", "", "O", "O", "", "", ""])).toBe("X");
    expect(tttResult(["O", "", "X", "O", "X", "", "O", "", ""])).toBe("O");
    expect(tttLine(["X", "O", "", "O", "X", "", "", "", "X"])?.cells).toEqual([0, 4, 8]);
    expect(tttResult(emptyTtt())).toBeNull();
  });
  it("calls a full board without a winner a draw", () => {
    expect(tttResult(["X", "O", "X", "X", "O", "O", "O", "X", "X"])).toBe("draw");
  });
});

describe("connect four", () => {
  it("drops discs to the bottom and stacks them", () => {
    const first = c4Drop(emptyC4(), 3, "X")!;
    expect(first.row).toBe(5);
    const second = c4Drop(first.grid, 3, "O")!;
    expect(second.row).toBe(4);
    expect(first.grid[4]![3]).toBe("");
  });
  it("refuses a full or invalid column", () => {
    let grid: C4Grid = emptyC4();
    for (let i = 0; i < 6; i++) grid = c4Drop(grid, 0, i % 2 ? "O" : "X")!.grid;
    expect(c4Drop(grid, 0, "X")).toBeNull();
    expect(c4Drop(grid, 7, "X")).toBeNull();
    expect(c4Drop(grid, -1, "X")).toBeNull();
  });
  it("finds four in a row in every direction", () => {
    let g = emptyC4();
    for (const col of [0, 1, 2, 3]) g = c4Drop(g, col, "X")!.grid;
    expect(c4Line(g)?.mark).toBe("X");
    let v = emptyC4();
    for (let i = 0; i < 4; i++) v = c4Drop(v, 6, "O")!.grid;
    expect(c4Result(v)).toBe("O");
    // diagonal: X at (5,0) (4,1) (3,2) (2,3)
    const d = emptyC4();
    d[5]![0] = "X";
    d[4]![1] = "X";
    d[3]![2] = "X";
    d[2]![3] = "X";
    expect(c4Line(d)?.cells).toHaveLength(4);
    expect(c4Result(emptyC4())).toBeNull();
  });
  it("calls a full grid without four in a row a draw", () => {
    // a known drawn pattern: columns filled in a repeating arrangement that avoids four in a row
    const pattern = ["XXOOXXO", "OOXXOOX", "XXOOXXO", "OOXXOOX", "XXOOXXO", "OOXXOOX"];
    const grid = pattern.map((row) => row.split("") as ("X" | "O")[]);
    expect(c4Result(grid)).toBe("draw");
  });
});

describe("trivia", () => {
  it("shuffles the answers and remembers which one is right", () => {
    for (const r of [0, 0.3, 0.6, 0.99]) {
      const { index, round } = triviaRound(TRIVIA, new Set(), seq(r, 0.7, 0.2, 0.9, 0.1));
      const right = TRIVIA[index]!.a[0];
      expect(round.options[round.correct]).toBe(right);
      expect(new Set(round.options).size).toBe(4);
    }
  });
  it("avoids recent questions until the bank is used up", () => {
    const recent = new Set(TRIVIA.map((_, i) => i).filter((i) => i !== 5));
    expect(triviaRound(TRIVIA, recent, () => 0.5).index).toBe(5);
    expect(triviaRound(TRIVIA, new Set(TRIVIA.map((_, i) => i)), () => 0.5).index).toBeGreaterThanOrEqual(0);
  });
  it("has a clean bank: four different answers, short text, no duplicate questions", () => {
    const seen = new Set<string>();
    for (const q of TRIVIA) {
      expect(new Set(q.a).size).toBe(4);
      expect(q.q.length).toBeLessThanOrEqual(200);
      for (const a of q.a) expect(a.length).toBeLessThanOrEqual(80);
      expect(seen.has(q.q)).toBe(false);
      seen.add(q.q);
    }
    expect(TRIVIA.length).toBeGreaterThanOrEqual(50);
  });
});

describe("the instant games", () => {
  it("flips and rolls within range", () => {
    expect(coinflip(() => 0.1)).toBe("heads");
    expect(coinflip(() => 0.9)).toBe("tails");
    expect(rollDie(6, () => 0)).toBe(1);
    expect(rollDie(6, () => 0.999)).toBe(6);
    expect(rollDie(1, () => 0.5)).toBeGreaterThanOrEqual(1); // clamped to a 2-sided die
    expect(rollDie(99999, () => 0.999999)).toBeLessThanOrEqual(1000);
  });
  it("answers the 8-ball from its list", () => {
    expect(EIGHT_BALL).toContain(eightBall(() => 0.5));
  });
});

describe("game XP", () => {
  it("never grants past the daily cap or below zero", () => {
    expect(grantableXp(20, 0, 200)).toBe(20);
    expect(grantableXp(20, 190, 200)).toBe(10);
    expect(grantableXp(20, 200, 200)).toBe(0);
    expect(grantableXp(20, 500, 200)).toBe(0);
    expect(grantableXp(20, 0, 0)).toBe(0);
    expect(grantableXp(-5, 0, 200)).toBe(0);
  });
  it("keys days in UTC", () => {
    expect(dayKey(new Date("2026-11-19T23:59:59Z"))).toBe("2026-11-19");
  });
});

describe("component ids", () => {
  it("round-trips and refuses anything else", () => {
    const id = newGameId(seq(0.1, 0.5, 0.9));
    expect(id).toMatch(/^[a-z0-9]{8}$/);
    expect(parseControl(controlId("t", id, 4))).toEqual({ kind: "t", id, arg: "4" });
    expect(parseControl("gm:x:abcdefgh:1")).toBeNull();
    expect(parseControl("gm:t:ab:1")).toBeNull();
    expect(parseControl("gm:t:abcdefgh:1234")).toBeNull();
    expect(parseControl("tk:open")).toBeNull();
  });
});
