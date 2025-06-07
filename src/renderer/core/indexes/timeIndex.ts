import { atom } from "jotai";
import BTree from "sorted-btree";
import { ProcessedData } from "~lib/adapters/logTypes";

// export const tree = 
export const treeAtom = atom(new BTree<number, ProcessedData[]>(undefined, (a, b) => b - a));
