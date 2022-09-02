import * as Lo from 'lodash';
export const createMemoryOutput = () => {
    const output = {
        memory: [],
        write(record) {
            output.memory.push(record);
        }
    };
    return output;
};
/**
 * Restore the key on given object before each test. Useful for permiting tests
 * to modify the environment and so on.
 */
export const resetBeforeEachTest = (object, key) => {
    const orig = object[key];
    beforeEach(() => {
        if (typeof orig === 'object') {
            object[key] = Lo.cloneDeep(orig);
        }
        else {
            object[key] = orig;
        }
    });
};
export const mockConsoleLog = () => {
    ;
    console.logOriginal = console.log;
    const calls = [];
    console.log = (...args) => calls.push(args);
    return calls;
};
export const unmockConsoleLog = () => {
    console.log = console.logOriginal;
};
//# sourceMappingURL=__helpers.mjs.map