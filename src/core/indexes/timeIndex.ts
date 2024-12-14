import BTree from "sorted-btree";
import { ProcessedData } from "~core/common/logTypes";

export const tree = new BTree<number, ProcessedData>(undefined, (a, b) => b - a);
