type Job = () => void;

let currentQueue = new Set<Job>();
let nextQueue = new Set<Job>();

let isFlushPending = false;

export function queueJob(
    job: Job
): void {
    // Si el job ya está pendiente en el lote actual,
    // re-encolarlo es un no-op: se ejecutará una sola vez.
    if (currentQueue.has(job)) {
        return;
    }
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

            while (currentQueue.size > 0) {
                // Se saca el job del lote antes de ejecutarlo,
                // de modo que un re-encolado durante su ejecución
                // (self-requeue) vaya al siguiente flush.
                const job = currentQueue.values().next().value as Job;
                currentQueue.delete(job);
                job();
            }
        }
    } finally {
        isFlushPending = false;
    }
}