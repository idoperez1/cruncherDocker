import BTree from "sorted-btree";
import { ProcessedData } from "~core/common/logTypes";

export type TreeData = {
    data: ProcessedData;
    index: number;
}
export const tree = new BTree<number, TreeData>(undefined, (a, b) => a - b);
