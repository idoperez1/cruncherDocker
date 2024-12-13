import { atom } from "jotai";
import { store } from "~core/store/store";


export const openIndexesAtom = atom<number[]>([]);

export const isIndexOpen = (index: number) => {
  return store.get(openIndexesAtom).includes(index);
}
