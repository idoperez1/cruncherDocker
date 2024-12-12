import { ProcessedData } from "~core/common/logTypes";
import { QueryOptions, QueryProvider } from "~core/common/interface";
import { buildQuery } from "./query";
import { Frame } from "./types";

const getAllObjects = (frames: Frame[]): ProcessedData[] => {
    const objects = frames.map((frame) => frame.data.values[0]).flat();
    const timestamps = frames.map((frame) => frame.data.values[1]).flat();
    const messages = frames.map((frame) => frame.data.values[2]).flat();
    const nanoSeconds = frames.map((frame) => frame.data.values[3]).flat();
    const indexInfo = frames.map((frame) => frame.data.values[4]).flat();
    const uniqueIds = frames.map((frame) => frame.data.values[5]).flat();

    const processedData = {
        objects,
        timestamps,
        messages,
        nanoSeconds,
        indexInfo,
        uniqueIds,
    };

    const getRow = (index: number): ProcessedData => {
        const object = processedData.objects[index];
        const timestamp = processedData.timestamps[index];
        const message = processedData.messages[index];
        const nanoSeconds = parseInt(processedData.nanoSeconds[index]);
        const uniqueId = processedData.uniqueIds[index];

        return {
            uniqueId,
            object,
            timestamp,
            message,
            nanoSeconds,
        };
    };


    return processedData.objects
        .map((_, index) => getRow(index))
        .sort((a, b) => a.nanoSeconds - b.nanoSeconds); // TODO: optimize and map sorting
}

export class GrafanaController implements QueryProvider {
    constructor(
        private url: string,
        private uid: string,
        private filter: string,
        private filterExtensions?: string[],
    ) { }

    private _doQuery = async (searchTerm: string[], options: QueryOptions) => {
        const query = buildQuery(this.uid, this.filter, searchTerm, options.fromTime, options.toTime, this.filterExtensions);
        console.log(query);

        const url = `${this.url}/api/ds/query?ds_type=loki&requestId=explore_gsx_1`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(query),
            signal: options.cancelToken,
        });

        const data = await response.json();

        if (data.results.A.status != 200) {
            throw new Error("Failed to execute query");
        }

        return getAllObjects(data.results.A.frames);
    }
    query(searchTerm: string[], queryOptions: QueryOptions): Promise<ProcessedData[]> {
        return this._doQuery(searchTerm, queryOptions);
    }

}
