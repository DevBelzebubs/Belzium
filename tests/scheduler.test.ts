import { describe, it, expect, vi } from "vitest";
import { queueJob } from "../src/reactive/scheduler";

describe("scheduler", () => {
  it("executes jobs asynchronously via microtask", async () => {
    let executed = false;
    queueJob(() => { executed = true; });
    expect(executed).toBe(false);
    await Promise.resolve();
    expect(executed).toBe(true);
  });

  it("deduplicates the same job", async () => {
    let count = 0;
    const job = () => { count++; };
    queueJob(job);
    queueJob(job);
    queueJob(job);
    await Promise.resolve();
    expect(count).toBe(1);
  });

  it("allows a job to requeue itself for the next flush", async () => {
    let executions = 0;
    const job = () => {
      executions++;
      if (executions === 1) {
        queueJob(job);
      }
    };
    queueJob(job);
    await Promise.resolve();
    expect(executions).toBe(2);
  });

  it("executes multiple different jobs in one flush", async () => {
    const order: string[] = [];
    queueJob(() => { order.push("a"); });
    queueJob(() => { order.push("b"); });
    queueJob(() => { order.push("c"); });
    await Promise.resolve();
    expect(order).toEqual(["a", "b", "c"]);
  });

  it("requeued jobs run in a subsequent flush, not the same one", async () => {
    const order: string[] = [];
    queueJob(() => {
      order.push("first-a");
      queueJob(() => { order.push("second-a"); });
    });
    queueJob(() => { order.push("first-b"); });
    await Promise.resolve();
    expect(order).toEqual(["first-a", "first-b", "second-a"]);
  });
});
