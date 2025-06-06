import { atom, createStore } from 'jotai'
import { searchQueryAtom } from './queryState';
import { endFullDateAtom, startFullDateAtom } from './dateState';
import { FullDate } from '~lib/dateUtils';
import { create } from 'zustand'

export type QueryState = {
    searchQuery: string;
    startTime: FullDate | undefined;
    endTime: FullDate | undefined;
}

export const queryStateAtom = atom<QueryState>((get) => {
    const searchQuery = get(searchQueryAtom);
    const startTime = get(startFullDateAtom);
    const endTime = get(endFullDateAtom);

    return {
        searchQuery,
        startTime,
        endTime,
    };
});

export const store: ReturnType<typeof createStore> = createStore();

export type ApplicationStore = {
    isInitialized: boolean;
    setIsInitialized: (isInitialized: boolean) => void;

    controllerParams: Record<string, string[]>;
    setControllerParams: (params: Record<string, string[]>) => void;
}

export const useApplicationStore = create<ApplicationStore>((set) => ({
    isInitialized: false,
    setIsInitialized: (isInitialized: boolean) => set({ isInitialized }),

    controllerParams: {},
    setControllerParams: (params: Record<string, string[]>) => set({ controllerParams: params }),
}));
