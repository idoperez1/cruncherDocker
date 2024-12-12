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
        data: data,
    } satisfies Events;

    return processPipeline(currentData, pipeline, 0);
}

const processPipeline = (currentData: DataFormatType, pipeline: PipelineItem[], currentIndex: number) => {
    if (currentIndex >= pipeline.length) {
        return currentData;
    }

    const currentPipeline = pipeline[currentIndex];

    switch (currentPipeline.type) {
        case "table":
            return processPipeline(processTable(currentData, currentPipeline.columns), pipeline, currentIndex + 1);
        case "stats":
            return processPipeline(processStats(currentData, currentPipeline.columns, currentPipeline.groupBy), pipeline, currentIndex + 1);
    }
}

const assertDataValuesAsNumbers = (input: (ProcessedData["object"][string] | undefined)[]): input is (number | undefined)[] => {
    return input.every((value) => typeof value === "number" || value === undefined);
}

// TODO: IMPLEMENT IT MORE EFFICIENTLY!
const processStats = (data: Events | Table, functions: AggregationFunction[], groupBy: string[] | undefined): Table => {
    const dataPoints = data.type === "events" ? data.data : data.dataPoints;
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

            switch (funcDef.function) {
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
            }
        }

        processedData.push(dataPoint);
    }

    const allColumns = [...(groupBy ?? []), ...functions.map(getFuncColName)];

    return {
        type: "table",
        columns: allColumns,
        dataPoints: processedData,
    }
}

const processTable = (data: Events | Table, columns: string[]): Table => {
    const dataPoints = data.type === "events" ? data.data : data.dataPoints;
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

    return {
        type: "table",
        columns,
        dataPoints: resultDataPoints,
    };
}