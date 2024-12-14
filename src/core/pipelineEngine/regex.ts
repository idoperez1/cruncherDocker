import { Events, Table } from "~core/common/displayTypes";
import { asDisplayString, asStringFieldOrUndefined, ProcessedData } from "~core/common/logTypes";



export const processRegex = (data: [Events, Table | undefined], regex: RegExp, column: string | undefined): [Events, Table | undefined] => {
    const [events, table] = data;
    const dataPoints = table ? table.dataPoints : events.data;

    const resultDataPoints: ProcessedData[] = [];
    // if column is not defined, search in json stringified object
    const searchInObject = column === undefined;

    const addedColumns = new Set<string>();

    console.log(regex, column, searchInObject);

    dataPoints.forEach((dataPoint) => {
        const term = searchInObject ? asStringFieldOrUndefined(dataPoint.object._raw)?.value ?? dataPoint.message : asDisplayString(dataPoint.object[column]);
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
