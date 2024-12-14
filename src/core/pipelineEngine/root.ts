import { ProcessedData } from "~core/common/logTypes";
import { PipelineItem } from "~core/qql";
import { processRegex } from "./regex";
import { Events, Table } from "~core/common/displayTypes";
import { processStats } from "./stats";
import { processTable } from "./table";

export const getPipelineItems = (data: ProcessedData[], pipeline: PipelineItem[]) => {
    const currentData = {
        type: "events",
        data: JSON.parse(JSON.stringify(data)), // deep copy
    } satisfies Events;

    return processPipeline([currentData, undefined], pipeline, 0);
}

const processPipeline = (currentData: [Events, Table | undefined], pipeline: PipelineItem[], currentIndex: number) => {
    if (currentIndex >= pipeline.length) {
        return currentData;
    }

    const currentPipeline = pipeline[currentIndex];

    switch (currentPipeline.type) {
        case "table":
            return processPipeline(processTable(currentData, currentPipeline.columns), pipeline, currentIndex + 1);
        case "stats":
            return processPipeline(processStats(currentData, currentPipeline.columns, currentPipeline.groupBy), pipeline, currentIndex + 1);
        case "regex":
            return processPipeline(processRegex(currentData, new RegExp(currentPipeline.pattern), currentPipeline.columnSelected), pipeline, currentIndex + 1);
        default:
            // @ts-expect-error - this should never happen
            throw new Error(`Pipeline type '${currentPipeline.type}' not implemented`);
    }
}