import { describe, it, expect } from "vitest";
import {
  scoreBucket,
  tierLabel,
  isQuestionActive,
  computeResult,
  computeOverallScore,
  uid,
  shuffleArray,
} from "../scoring";
import type { Topic, Solution } from "../schema";

// ---- scoreBucket ----
describe("scoreBucket", () => {
  it("returns good for >= 80", () => {
    expect(scoreBucket(80)).toBe("good");
    expect(scoreBucket(100)).toBe("good");
  });
  it("returns warn for 60-79", () => {
    expect(scoreBucket(60)).toBe("warn");
    expect(scoreBucket(79)).toBe("warn");
  });
  it("returns bad for < 60", () => {
    expect(scoreBucket(0)).toBe("bad");
    expect(scoreBucket(59)).toBe("bad");
  });
});

// ---- tierLabel ----
describe("tierLabel", () => {
  it("labels four tiers correctly", () => {
    expect(tierLabel(100)).toBe("Óptimo");
    expect(tierLabel(80)).toBe("Óptimo");
    expect(tierLabel(60)).toBe("Consolidado");
    expect(tierLabel(40)).toBe("En desarrollo");
    expect(tierLabel(39)).toBe("Inicial");
    expect(tierLabel(0)).toBe("Inicial");
  });
});

// ---- isQuestionActive ----
describe("isQuestionActive", () => {
  it("returns true when showIf is null", () => {
    expect(isQuestionActive({ showIf: null }, {})).toBe(true);
  });
  it("returns true when condition is met", () => {
    const q = { showIf: { questionId: "q1", optionIds: ["opt-yes"] } };
    expect(isQuestionActive(q, { q1: "opt-yes" })).toBe(true);
  });
  it("returns false when condition is not met", () => {
    const q = { showIf: { questionId: "q1", optionIds: ["opt-yes"] } };
    expect(isQuestionActive(q, { q1: "opt-no" })).toBe(false);
  });
  it("returns false when the triggering question is unanswered", () => {
    const q = { showIf: { questionId: "q1", optionIds: ["opt-yes"] } };
    expect(isQuestionActive(q, {})).toBe(false);
  });
});

// ---- helpers for building test fixtures ----
function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: "t1",
    name: "Tema 1",
    scoring: "weighted",
    includeInOverall: true,
    weight: 1,
    questions: [
      {
        id: "q1",
        text: "Pregunta 1",
        options: [
          { id: "o1", label: "A", points: 0, correct: false },
          { id: "o2", label: "B", points: 100, correct: true },
        ],
      },
    ],
    ...overrides,
  };
}

// ---- computeResult ----
describe("computeResult — weighted scoring", () => {
  const topics = [makeTopic()];

  it("scores 100 when best option is selected", () => {
    const r = computeResult(topics, [], { q1: "o2" });
    expect(r.overall).toBe(100);
    expect(r.overallBucket).toBe("good");
    expect(r.topicResults[0].grade).toBe(100);
  });

  it("scores 0 when worst option is selected", () => {
    const r = computeResult(topics, [], { q1: "o1" });
    expect(r.overall).toBe(0);
    expect(r.overallBucket).toBe("bad");
  });

  it("scores 0 when nothing is answered", () => {
    const r = computeResult(topics, [], {});
    expect(r.overall).toBe(0);
  });

  it("handles empty topics gracefully", () => {
    const r = computeResult([], [], {});
    expect(r.overall).toBe(0);
    expect(r.topicResults).toHaveLength(0);
    expect(r.triggered).toHaveLength(0);
  });
});

describe("computeResult — percent scoring", () => {
  const topics = [makeTopic({ scoring: "percent" })];

  it("scores 100 when correct option is selected", () => {
    const r = computeResult(topics, [], { q1: "o2" });
    expect(r.overall).toBe(100);
  });

  it("scores 0 when incorrect option is selected", () => {
    const r = computeResult(topics, [], { q1: "o1" });
    expect(r.overall).toBe(0);
  });
});

describe("computeResult — topic weight", () => {
  it("weights topics proportionally", () => {
    const topicA = makeTopic({ id: "tA", weight: 3, questions: [{ id: "qA", text: "A", options: [{ id: "oA", label: "A", points: 100, correct: true }] }] });
    const topicB = makeTopic({ id: "tB", weight: 1, questions: [{ id: "qB", text: "B", options: [{ id: "oB", label: "B", points: 0, correct: false }] }] });
    const r = computeResult([topicA, topicB], [], { qA: "oA", qB: "oB" });
    // (100*3 + 0*1) / 4 = 75
    expect(r.overall).toBe(75);
  });
});

describe("computeResult — includeInOverall=false", () => {
  it("excludes topic from overall score", () => {
    const included = makeTopic({ id: "t1", questions: [{ id: "q1", text: "x", options: [{ id: "o1", label: "A", points: 100, correct: true }] }] });
    const excluded = makeTopic({ id: "t2", includeInOverall: false, questions: [{ id: "q2", text: "x", options: [{ id: "o2", label: "A", points: 0, correct: false }] }] });
    const r = computeResult([included, excluded], [], { q1: "o1", q2: "o2" });
    expect(r.overall).toBe(100); // excluded topic doesn't pull it down
  });
});

describe("computeResult — solution triggering", () => {
  const topics = [makeTopic()];

  it("triggers a solution when condition is met", () => {
    const sol: Solution = {
      id: "s1", name: "Solución", description: "", category: "",
      logic: "all",
      conditions: [{ scope: "overall", operator: "below", threshold: 50 }],
    };
    const r = computeResult(topics, [sol], { q1: "o1" }); // score = 0
    expect(r.triggered).toHaveLength(1);
    expect(r.triggered[0].id).toBe("s1");
  });

  it("does not trigger a solution when condition is not met", () => {
    const sol: Solution = {
      id: "s1", name: "Solución", description: "", category: "",
      logic: "all",
      conditions: [{ scope: "overall", operator: "below", threshold: 50 }],
    };
    const r = computeResult(topics, [sol], { q1: "o2" }); // score = 100
    expect(r.triggered).toHaveLength(0);
  });

  it("triggers with 'any' logic when at least one condition is met", () => {
    const sol: Solution = {
      id: "s1", name: "Solución", description: "", category: "",
      logic: "any",
      conditions: [
        { scope: "overall", operator: "above", threshold: 90 }, // not met (score=0)
        { scope: "overall", operator: "below", threshold: 50 }, // met (score=0)
      ],
    };
    const r = computeResult(topics, [sol], { q1: "o1" });
    expect(r.triggered).toHaveLength(1);
  });
});

// ---- computeOverallScore ----
describe("computeOverallScore", () => {
  it("matches computeResult overall for single topic", () => {
    const topics = [makeTopic()];
    const answers = { q1: "o2" };
    const full = computeResult(topics, [], answers);
    expect(computeOverallScore(topics, answers)).toBe(full.overall);
  });

  it("returns 0 for empty topics", () => {
    expect(computeOverallScore([], {})).toBe(0);
  });
});

// ---- uid ----
describe("uid", () => {
  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uid("x")));
    expect(ids.size).toBe(1000);
  });

  it("uses the given prefix", () => {
    expect(uid("test")).toMatch(/^test_/);
    expect(uid()).toMatch(/^id_/);
  });

  it("does not use Math.random (IDs are hex/UUID chars only)", () => {
    const id = uid("pfx");
    expect(id).toMatch(/^pfx_[0-9a-f]+$/);
  });
});

// ---- shuffleArray ----
describe("shuffleArray", () => {
  it("preserves all elements", () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray(arr);
    expect(shuffled).toHaveLength(arr.length);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(arr);
  });

  it("does not mutate the original array", () => {
    const arr = [1, 2, 3];
    const copy = [...arr];
    shuffleArray(arr);
    expect(arr).toEqual(copy);
  });

  it("handles empty and single-element arrays", () => {
    expect(shuffleArray([])).toEqual([]);
    expect(shuffleArray([42])).toEqual([42]);
  });
});
