
type Job = () => void;

let currentQueue = new Set<Job>();
let nextQueue = new Set<Job>();

let isFlushPending = false;

export function queueJob(
    job: Job
): void {
    nextQueue.add(job);
    if (!isFlushPending) {
        isFlushPending = true;
        queueMicrotask(flushJobs);
    }
}
function flushJobs(): void {
    try {
        while (nextQueue.size > 0) {
            const pending = nextQueue;
            nextQueue = currentQueue;
            currentQueue = pending;

            for (const job of currentQueue) {
                job();
            }
            currentQueue.clear();
        }
    } finally {
        isFlushPending = false;
    }
}
