import { Events, Table } from "~core/common/displayTypes";
import { ProcessedData } from "~core/common/logTypes";


export const processTable = (data: [Events, Table | undefined], columns: string[]): [Events, Table | undefined] => {
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
