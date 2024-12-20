import { ControllerIndexParam, Search } from "~core/qql/grammar";
import { ProcessedData } from "./logTypes";

export type QueryOptions = {
    fromTime: Date,
    toTime: Date,
    cancelToken: AbortSignal
    limit: number,
    onBatchDone: (data: ProcessedData[]) => void
}

export interface QueryProvider {
    query(params: ControllerIndexParam[], searchTerm: Search, queryOptions: QueryOptions): Promise<void>;
}