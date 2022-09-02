import * as Output from '../src/output.mjs';
/**
 * A mock output stream useful for passing to logger and later reflecting on the
 * values that it wrote.
 */
export declare type MemoryOutput = Output.Output & {
    memory: Record<string, any>[];
};
export declare const createMemoryOutput: () => MemoryOutput;
/**
 * Restore the key on given object before each test. Useful for permiting tests
 * to modify the environment and so on.
 */
export declare const resetBeforeEachTest: (object: any, key: string) => void;
export declare const mockConsoleLog: () => any[][];
export declare const unmockConsoleLog: () => void;
//# sourceMappingURL=__helpers.d.mts.map