export const measureTime = <T>(id: string, fn: () => T) => {
    const start = Date.now();
    const res = fn();
    console.log(`[Time Measure] [${id}] Time taken: ${Date.now() - start}ms`);
    return res;
}