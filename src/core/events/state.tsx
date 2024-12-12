import { atom } from "jotai";
import { store } from "../state";


export const openIndexesAtom = atom<number[]>([]);

export const isIndexOpen = (index: number) => {
  return store.get(openIndexesAtom).includes(index);
}
