import { Events, Table } from "~core/common/displayTypes";
import { asDisplayString, asNumberField, Field, NumberField, ProcessedData } from "~core/common/logTypes";
import { AggregationFunction } from "~core/qql/grammar";



const assertDataValuesAsNumbers = (input: Field[]): input is (NumberField | undefined | null)[] => {
    return input.every((value) => value === undefined || value === null || asNumberField(value).errors === undefined);
}

export const SUPPORTED_AGG_FUNCTIONS = ["first", "last", "count", "sum", "avg", "min", "max"] as const;

type SupportedAggFunction = typeof SUPPORTED_AGG_FUNCTIONS[number];

// TODO: IMPLEMENT IT MORE EFFICIENTLY!
export const processStats = (data: [Events, Table | undefined], functions: AggregationFunction[], groupBy: string[] | undefined): [Events, Table | undefined] => {
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
        if (func.alias) {
            return func.alias;
        }

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

            if (!SUPPORTED_AGG_FUNCTIONS.includes(funcDef.function as SupportedAggFunction)) {
                throw new Error(`Function '${funcDef.function}' is not supported`);
            }

            const func = funcDef.function as SupportedAggFunction;

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
