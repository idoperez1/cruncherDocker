import { Search } from "~core/qql/grammar";
import { ProcessedData } from "./logTypes";

export type QueryOptions = {
    fromTime: Date,
    toTime: Date,
    cancelToken: AbortSignal
    limit: number,
    onBatchDone: (data: ProcessedData[]) => void
}

export interface QueryProvider {
    query(searchTerm: Search, queryOptions: QueryOptions): Promise<void>;
}