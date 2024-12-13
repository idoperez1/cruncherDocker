import { atom } from 'jotai';
import { ProcessedData } from '~core/common/logTypes';
import { DataFormatType } from '~core/common/queryUtils';
import { allData } from '~core/qql';

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



