export declare class Lint {
    constructor(dist: string, { ignoreExtensions }?: {
        ignoreExtensions?: boolean;
    });
    dist: string;
    totalNum: number;
    errors: Map<string, {
        loc?: string;
        msg: string;
        level: number;
    }[]>;
    ignoreExtensions: boolean;
    private addError;
    init(): Promise<void>;
    summary(): void;
    exitCode(): 1 | 0;
}
export declare class Build {
    constructor(dir: string, options?: any);
    dir: string;
    options: any;
    result: Map<string, string>;
    init(): Promise<Map<string, string>>;
    write(out: string, result?: Map<string, string>): Promise<void>;
}
export declare function run(argv: string[]): Promise<void>;
