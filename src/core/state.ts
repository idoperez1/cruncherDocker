
import { atom, createStore } from 'jotai'
import { allData } from './qql';
import { ProcessedData } from './common/logTypes';
import { DataFormatType } from './common/queryUtils';

export const searchQueryAtom = atom(''); // search query

export const queryDataAtom = atom((get) => {
    const searchQuery = get(searchQueryAtom);
    return allData(searchQuery);
});

export const objectsAtom = atom<ProcessedData[]>([]);
export const dataViewModelAtom = atom<DataFormatType>();

export const availableColumnsAtom = atom((get) => {
    const data = get(objectsAtom);
    if (!data.length) {
        return [];
    }

    return Object.keys(data[0].object);
});



export const store: ReturnType<typeof createStore> = createStore();

