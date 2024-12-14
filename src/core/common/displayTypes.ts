import { ProcessedData } from "./logTypes";

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
