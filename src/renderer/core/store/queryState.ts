import { scaleLinear } from 'd3-scale';
import { atom } from 'jotai';
import React from 'react';
import { create, ExtractState } from 'zustand';
import { asDateField, ProcessedData } from '~lib/adapters/logTypes';
import { DisplayResults, Events } from '~lib/displayTypes';
import { allData } from '~lib/qql';
import { actualEndTimeAtom, actualStartTimeAtom } from './dateState';
import BTree from 'sorted-btree';

export const searchQueryAtom = atom(''); // search query

export const queryDataAtom = atom((get) => {
  const searchQuery = get(searchQueryAtom);
  return allData(searchQuery);
});

type QuerySpecificStore = {
  index: BTree<number, ProcessedData[]>; 
  originalData: ProcessedData[];
  setOriginalData: (data: ProcessedData[]) => void;
}

export const createQuerySpecificStore = () => {
  return create<QuerySpecificStore>((set) => ({
    index: new BTree<number, ProcessedData[]>(undefined, (a, b) => b - a),
    originalData: [],
    setOriginalData: (data: ProcessedData[]) => set({ originalData: data }),
  }));
}

export const QuerySpecificContext = React.createContext<ReturnType<typeof createQuerySpecificStore> | null>(null);

export const useQuerySpecificStore = <U>(selector: (state: ExtractState<ReturnType<typeof createQuerySpecificStore>>) => U) => {
  const store = useQuerySpecificStoreInternal();
  return store(selector);
}

export const useQuerySpecificStoreInternal = () => {
  const store = React.useContext(QuerySpecificContext);
  if (!store) {
    throw new Error('useQuerySpecificStoreInternal must be used within a QuerySpecificProvider');
  }

  return store;
}

export const dataViewModelAtom = atom<DisplayResults>(
  {
    events: {
      type: "events",
      data: [],
    },
    table: undefined,
    view: undefined,
  },
);

export const eventsAtom = atom<Events>((get) => {
  return get(dataViewModelAtom).events;
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


export const scaleAtom = atom((get) => {
  const selectedStartTime = get(actualStartTimeAtom);
  const selectedEndTime = get(actualEndTimeAtom);

  if (!selectedStartTime || !selectedEndTime) {
    return;
  }

  return scaleLinear().domain([
    selectedStartTime.getTime(),
    selectedEndTime.getTime(),
  ]);
});

export const dataBucketsAtom = atom((get) => {
  const scale = get(scaleAtom);
  if (!scale) {
    return [];
  }


  const buckets: Record<number, number> = {};
  const ticks = scale.ticks(100);

  const data = get(eventsAtom).data;

  data.forEach((object) => {
    // round timestamp to the nearest tick
    const timestamp = ticks.reduce((prev, curr) => {
      const thisTimestamp = asDateField(object.object._time).value;

      return Math.abs(curr - thisTimestamp) < Math.abs(prev - thisTimestamp)
        ? curr
        : prev;
    });
    if (!buckets[timestamp]) {
      buckets[timestamp] = 0;
    }

    buckets[timestamp] += 1;
  });

  return Object.entries(buckets).map(([timestamp, count]) => ({
    timestamp: parseInt(timestamp),
    count,
  }));
});


export const viewSelectedForQueryAtom = atom<boolean>(false);
