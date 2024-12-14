import { atom } from 'jotai';
import { ProcessedData } from '~core/common/logTypes';
import { Events, Table } from '~core/common/queryUtils';
import { allData } from '~core/qql';

export const searchQueryAtom = atom(''); // search query

export const queryDataAtom = atom((get) => {
    const searchQuery = get(searchQueryAtom);
    return allData(searchQuery);
});

export const objectsAtom = atom<ProcessedData[]>([]);
export const dataViewModelAtom = atom<[Events, Table | undefined]>();

export const availableColumnsAtom = atom((get) => {
    const data = get(objectsAtom);
    if (!data.length) {
        return [];
    }

    const columns = new Set<string>();
    data.forEach((dataPoint) => {
        for (const key in dataPoint.object) {
            columns.add(key);
        }
    });

    return Array.from(columns);
});



