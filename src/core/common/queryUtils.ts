import { PipelineItem } from "~core/qql";
import { AggregationFunction } from "../qql/grammar";
import { asDisplayString, asNumberField, Field, NumberField, ProcessedData } from "./logTypes";

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


const processRegex = (data: [Events, Table | undefined], regex: RegExp, column: string | undefined): [Events, Table | undefined] => {
    const [events, table] = data;
    const dataPoints = table ? table.dataPoints : events.data;

    const resultDataPoints: ProcessedData[] = [];
    // if column is not defined, search in json stringified object
    const searchInObject = column === undefined;

    const addedColumns = new Set<string>();

    dataPoints.forEach((dataPoint) => {
        const term = searchInObject ? JSON.stringify(dataPoint.object) : asDisplayString(dataPoint.object[column]);
        const match = regex.exec(term);

        if (match) {
            // iterate over all groups - and set them in the object
            Object.entries(match.groups ?? {}).forEach(([key, value]) => {
                addedColumns.add(key);
                dataPoint.object[key] = {
                    type: "string",
                    value,
                };
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


const assertDataValuesAsNumbers = (input: Field[]): input is (NumberField | undefined | null)[] => {
    return input.every((value) => value === undefined || value === null || asNumberField(value).errors === undefined);
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
        const groupKey = groupBy ? groupBy.map((column) => asDisplayString(dataPoint.object[column]) ?? "").join(",") : "all";
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
            message: "",
        };

        for (const column of groupBy ?? []) {
            // populate the value of the column - all objects in the group should have the same value - so we can just take the first one
            dataPoint.object[column] = groupData?.[0].object[column]; 
        }

        for (const funcDef of functions) {
            const columnData = groupData.map((dataPoint) => {
                if (funcDef.column === undefined) {
                    return undefined;
                }

                return dataPoint.object[funcDef.column]
            });

            const resultColumnName = getFuncColName(funcDef);

            if (!SUPPORTED_FUNCTIONS.includes(funcDef.function as SupportedFunction)) {
                throw new Error(`Function '${funcDef.function}' is not supported`);
            }

            const func = funcDef.function as SupportedFunction;

            switch (func) {
                case "first":
                    dataPoint.object[resultColumnName] = columnData.find((value) => value !== undefined);
                    break;
                
                case "last":
                    dataPoint.object[resultColumnName] = columnData.reverse().find((value) => value !== undefined);
                    break;

                case "count":
                    dataPoint.object[resultColumnName] = {
                        type: "number",
                        value: columnData.length
                    };
                    break;
                case "sum":
                    if (!assertDataValuesAsNumbers(columnData)) {
                        throw new Error("Data values are not numbers");
                    }

                    dataPoint.object[resultColumnName] = {
                        type: "number",
                        value: columnData.reduce((acc, value) => (acc ?? 0) + (value?.value ?? 0), 0)
                    };
                    break;
                case "avg":
                    if (!assertDataValuesAsNumbers(columnData)) {
                        throw new Error("Data values are not numbers");
                    }

                    const res = columnData.reduce((acc, value) => (acc ?? 0) + (value?.value ?? 0), 0);

                    dataPoint.object[resultColumnName] = {
                        type: "number",
                        value: res / columnData.length,
                    }
                    break;
                case "min":
                    if (!assertDataValuesAsNumbers(columnData)) {
                        throw new Error("Data values are not numbers");
                    }

                    dataPoint.object[resultColumnName] = {
                        type: "number",
                        value: Math.min(...columnData.filter((value) => value !== undefined && value !== null).map((value) => value.value))
                    };
                    break;
                case "max":
                    if (!assertDataValuesAsNumbers(columnData)) {
                        throw new Error("Data values are not numbers");
                    }

                    dataPoint.object[resultColumnName] = {
                        type: "number",
                        value: Math.max(...columnData.filter((value) => value !== undefined && value !== null).map((value) => value.value))
                    }
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