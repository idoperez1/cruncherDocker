import { ProcessedData } from "./logTypes";

export type QueryOptions = {
    fromTime: Date,
    toTime: Date,
    cancelToken: AbortSignal
}

export interface QueryProvider {
    query(searchTerm: string[], queryOptions: QueryOptions): Promise<ProcessedData[]>;
}