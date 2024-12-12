
import { atom, createStore } from 'jotai'

export const searchQuery = atom(''); // search query


export const store: ReturnType<typeof createStore> = createStore();

