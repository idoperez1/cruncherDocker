import { Events, Table } from "~core/common/displayTypes";
import { LogicalExpression } from "~core/qql/grammar";
import { processLogicalExpression } from "./logicalExpression";


export const processWhere = (data: [Events, Table | undefined], logicalExpression: LogicalExpression): [Events, Table | undefined] => {
    const [events, table] = data;

    const newEvents: Events = {
        type: "events",
        data: events.data.filter((processedData) => processLogicalExpression(logicalExpression, { data: processedData })),
    };

    const newTable: Table | undefined = table && {
        type: "table",
        columns: table.columns,
        dataPoints: table.dataPoints.filter((processedData) => processLogicalExpression(logicalExpression, { data: processedData })),
    };

    return [newEvents, newTable];
}