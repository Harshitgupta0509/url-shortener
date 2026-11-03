import { afterEach, describe, expect, it, vi } from "vitest";
import { toBase62 } from "./base62";
import { Snowflake } from "./snowflake";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Snowflake", () => {
  it("creates unique, increasing IDs", () => {
    const generator = new Snowflake(1);
    const ids = Array.from({ length: 100_000 }, () => generator.nextId());

    expect(new Set(ids).size).toBe(ids.length);

    for (let i = 1; i < ids.length; i++) {
      expect(ids[i] > ids[i - 1]).toBe(true);
    }
  });

  it("creates different IDs on different machines", () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 10, 3));

    const india = new Snowflake(1).nextId();
    const us = new Snowflake(2).nextId();

    expect(india).not.toBe(us);
  });

  it("rejects an invalid machine ID", () => {
    expect(() => new Snowflake(1024)).toThrow();
  });

  it("throws if the clock moves backwards", () => {
    const now = vi.spyOn(Date, "now");
    const generator = new Snowflake(1);

    now.mockReturnValue(Date.UTC(2026, 10, 3, 12));
    generator.nextId();

    now.mockReturnValue(Date.UTC(2026, 10, 3, 11));
    expect(() => generator.nextId()).toThrow("Clock moved backwards");
  });
});

describe("toBase62", () => {
  it("converts numbers correctly", () => {
    expect(toBase62(0n)).toBe("0");
    expect(toBase62(61n)).toBe("Z");
    expect(toBase62(62n)).toBe("10");
  });
});
