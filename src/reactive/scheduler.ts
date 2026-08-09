
type Job = () => void;

const queue = new Set<Job>(); // Set para deduplicación

let isFlushPending = false;

export function queueJob(
    job: Job
): void {
    queue.add(job); // Agrega el job al set de jobs (Esto evita que se agreguen jobs duplicados)
    if (!isFlushPending) {
        isFlushPending = true;
        queueMicrotask(flushJobs); // Programa la ejecución de flushJobs en la siguiente microtarea
    }
}
function flushJobs(): void { // Ejecuta todos los jobs en la cola y limpia la cola después de ejecutarlos
    try {
        for (const job of queue) { // Itera jobs
            job();
        }
    } finally {
        queue.clear(); // Limpia la cola de jobs
        isFlushPending = false;
    }
}