import { atom } from 'jotai';
import { ProcessedData } from '~core/common/logTypes';
import { Events, Table } from '~core/common/queryUtils';
import { allData } from '~core/qql';

export const searchQueryAtom = atom(''); // search query

export const queryDataAtom = atom((get) => {
    const searchQuery = get(searchQueryAtom);
    return allData(searchQuery);
});

export const originalDataAtom = atom<ProcessedData[]>([]);
export const dataViewModelAtom = atom<[Events, Table | undefined]>([
    {
        type: "events",
        data: []
    },
    undefined,
]);

export const eventsAtom = atom<Events>((get) => {
    return get(dataViewModelAtom)[0];
})

export const availableColumnsAtom = atom((get) => {
    const events = get(eventsAtom);
    const data = events.data;
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



