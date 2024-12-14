import { ProcessedData } from "./logTypes";

export type QueryOptions = {
    fromTime: Date,
    toTime: Date,
    cancelToken: AbortSignal
    onBatchDone: (data: ProcessedData[]) => void
}

export interface QueryProvider {
    query(searchTerm: string[], queryOptions: QueryOptions): Promise<void>;
}