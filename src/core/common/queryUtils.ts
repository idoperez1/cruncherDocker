import { PipelineItem } from "~core/qql";
import { ProcessedData } from "./logTypes";
import { AggregationFunction, isNumeric } from "../qql/grammar";

export type Events = {
    type: "events",
    data: ProcessedData[],
}

export type Table = {
    type: "table",
    columns: string[],
    dataPoints: ProcessedData[],
}

export type DataFormatType =
    | Events
    | Table



export const getPipelineItems = (data: ProcessedData[], pipeline: PipelineItem[]) => {
    const currentData = {
        type: "events",
        data: JSON.parse(JSON.stringify(data)), // deep copy
    } satisfies Events;

    return processPipeline([currentData, undefined], pipeline, 0);
}

const processPipeline = (currentData: [Events, Table | undefined], pipeline: PipelineItem[], currentIndex: number) => {
    if (currentIndex >= pipeline.length) {
        return currentData;
    }

    const currentPipeline = pipeline[currentIndex];

    switch (currentPipeline.type) {
        case "table":
            return processPipeline(processTable(currentData, currentPipeline.columns), pipeline, currentIndex + 1);
        case "stats":
            return processPipeline(processStats(currentData, currentPipeline.columns, currentPipeline.groupBy), pipeline, currentIndex + 1);
        case "regex":
            return processPipeline(processRegex(currentData, new RegExp(currentPipeline.pattern), currentPipeline.columnSelected), pipeline, currentIndex + 1);
        default:
            // @ts-expect-error - this should never happen
            throw new Error(`Pipeline type '${currentPipeline.type}' not implemented`);
    }
}

const asString = (data: ProcessedData["object"][string] | undefined) => {
    if (data === undefined) {
        return "";
    }

    return data.toString();
}

const processRegex = (data: [Events, Table | undefined], regex: RegExp, column: string | undefined): [Events, Table | undefined] => {
    const [events, table] = data;
    const dataPoints = table ? table.dataPoints : events.data;

    const resultDataPoints: ProcessedData[] = [];
    // if column is not defined, search in json stringified object
    const searchInObject = column === undefined;

    const addedColumns = new Set<string>();

    dataPoints.forEach((dataPoint) => {
        const term = searchInObject ? JSON.stringify(dataPoint.object) : asString(dataPoint.object[column ?? ""]);
        const match = regex.exec(term);

        if (match) {
            // iterate over all groups - and set them in the object
            Object.entries(match.groups ?? {}).forEach(([key, value]) => {
                addedColumns.add(key);
                dataPoint.object[key] = value;
            })
        }

        resultDataPoints.push(dataPoint);
    });

    return [
        events,
        table && {
            type: "table",
            columns: [...table.columns, ...addedColumns],
            dataPoints: resultDataPoints,
        }
    ]
}


const assertDataValuesAsNumbers = (input: (ProcessedData["object"][string] | undefined)[]): input is (number | undefined)[] => {
    return input.every((value) => typeof value === "number" || value === undefined);
}

export const SUPPORTED_FUNCTIONS = ["first", "last", "count", "sum", "avg", "min", "max"] as const;

type SupportedFunction = typeof SUPPORTED_FUNCTIONS[number];

// TODO: IMPLEMENT IT MORE EFFICIENTLY!
const processStats = (data: [Events, Table | undefined], functions: AggregationFunction[], groupBy: string[] | undefined): [Events, Table | undefined] => {
    const [events, table] = data;
    const dataPoints = table ? table.dataPoints : events.data;
    // get unique groups
    const groups: Record<string, ProcessedData[]> = {};

    for (const dataPoint of dataPoints) {
        const groupKey = groupBy ? groupBy.map((column) => dataPoint.object[column] ?? "").join(",") : "all";
        if (!groups[groupKey]) {
            groups[groupKey] = [];
        }

        groups[groupKey].push(dataPoint);
    }

    const getFuncColName = (func: AggregationFunction) => {
        return func.column ? `${func.function}(${func.column})` : func.function;
    }

    const processedData: ProcessedData[] = [];
    for (const groupKey in groups) {
        const groupData = groups[groupKey];
        const dataPoint: ProcessedData = {
            object: {},
            timestamp: 0,
            nanoSeconds: 0,
            uniqueId: "",
            message: "",
        };

        for (const column of groupBy ?? []) {
            dataPoint.object[column] = groupData[0].object[column];
        }

        for (const funcDef of functions) {
            const columnData = groupData.map((dataPoint) => {
                if (funcDef.column === undefined) {
                    return undefined;
                }

                if (funcDef.column === "_time") {
                    return dataPoint.timestamp;
                }

                const data = dataPoint.object[funcDef.column];

                if (typeof data === "string" && isNumeric(data)) {
                    return parseFloat(data);
                }

                return dataPoint.object[funcDef.column]
            });

            const resultColumnName = getFuncColName(funcDef);

            // assert existing column is number or undefined
            const existingValue = dataPoint.object[resultColumnName];
            if (!(existingValue === undefined || typeof existingValue === "number")) {
                throw new Error(`Existing value for column ${resultColumnName} is not a number`);
            }

            const valueToUse = existingValue ?? 0;

            if (!SUPPORTED_FUNCTIONS.includes(funcDef.function as SupportedFunction)) {
                throw new Error(`Function '${funcDef.function}' is not supported`);
            }

            const func = funcDef.function as SupportedFunction;

            switch (func) {
                case "first":
                    dataPoint.object[resultColumnName] = columnData.find((value) => value !== undefined) ?? "";
                    break;
                
                case "last":
                    dataPoint.object[resultColumnName] = columnData.reverse().find((value) => value !== undefined) ?? "";
                    break;

                case "count":
                    dataPoint.object[resultColumnName] = columnData.length;
                    break;
                case "sum":
                    if (!assertDataValuesAsNumbers(columnData)) {
                        throw new Error("Data values are not numbers");
                    }

                    dataPoint.object[resultColumnName] = columnData.reduce((acc, value) => (acc ?? 0) + (value ?? 0), valueToUse) ?? 0;
                    break;
                case "avg":
                    if (!assertDataValuesAsNumbers(columnData)) {
                        throw new Error("Data values are not numbers");
                    }

                    const res = columnData.reduce((acc, value) => (acc ?? 0) + (value ?? 0), valueToUse) ?? 0;

                    dataPoint.object[resultColumnName] = res / columnData.length;
                    break;
                case "min":
                    if (!assertDataValuesAsNumbers(columnData)) {
                        throw new Error("Data values are not numbers");
                    }

                    dataPoint.object[resultColumnName] = Math.min(...columnData.filter((value) => value !== undefined));
                    break;
                case "max":
                    if (!assertDataValuesAsNumbers(columnData)) {
                        throw new Error("Data values are not numbers");
                    }

                    dataPoint.object[resultColumnName] = Math.max(...columnData.filter((value) => value !== undefined));
                    break;
                    
                default:
                    throw new Error(`Function '${func}' not implemented`);
            }
        }

        processedData.push(dataPoint);
    }

    const allColumns = [...(groupBy ?? []), ...functions.map(getFuncColName)];

    return [events, {
        type: "table",
        columns: allColumns,
        dataPoints: processedData,
    }]
}

const processTable = (data: [Events, Table | undefined], columns: string[]): [Events, Table | undefined] => {
    const [events, table] = data;
    const dataPoints = table ? table.dataPoints : events.data;

    const resultDataPoints: ProcessedData[] = [];
    for (const dataPoint of dataPoints) {
        const newDataPoint: ProcessedData = {
            object: {},
            timestamp: dataPoint.timestamp,
            nanoSeconds: dataPoint.nanoSeconds,
            uniqueId: dataPoint.uniqueId,
            message: dataPoint.message,
        };

        for (const column of columns) {
            newDataPoint.object[column] = dataPoint.object[column];
        }

        resultDataPoints.push(newDataPoint);
    }

    return [events, {
        type: "table",
        columns,
        dataPoints: resultDataPoints,
    }];
}