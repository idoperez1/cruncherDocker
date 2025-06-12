import { atom } from 'jotai';
import { PluginInstance, SupportedPlugin } from 'src/plugins_engine/types';
import { create } from 'zustand';
import { QueryProvider } from '~core/common/interface';
import { notifyError } from '~core/notifyError';
import { ApiController } from '~core/store/ApiController';
import { FullDate } from '~lib/dateUtils';
import { StreamConnection } from '~lib/network';
import { endFullDateAtom, startFullDateAtom } from './dateState';
import { searchQueryAtom } from './queryState';

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

type ControllerParams = Record<string, string[]>;

export type ApplicationStore = {
    controller: ApiController;

    isInitialized: boolean;
    initialize: (connection: StreamConnection) => void;

    controllerParams: Record<string, ControllerParams>;
    setControllerParams: (instanceId: string, params: ControllerParams) => void;

    providers: Record<string, QueryProvider>;
    supportedPlugins: SupportedPlugin[];
    initializedInstances: PluginInstance[];
    setSupportedPlugins: (plugins: SupportedPlugin[]) => void;
    setInitializedInstances: (instances: PluginInstance[]) => void;
}

export const useApplicationStore = create<ApplicationStore>((set, get) => ({
    controller: null as unknown as ApiController,

    isInitialized: false,
    initialize: async (connection: StreamConnection) => {
        const controller = new ApiController(connection);
        set({ isInitialized: false, controller });
        try {
            console.log('Controller initialized successfully.');
            const supportedPlugins = await controller.listPlugins();
            set({ supportedPlugins });
            console.log('Supported plugins fetched:', supportedPlugins);
            const initializedInstances = await controller.listInitializedPlugins();
            console.log('Initialized instances fetched:', initializedInstances);
            // Create providers for each initialized instance
            const providers: Record<string, QueryProvider> = {};
            initializedInstances.forEach(instance => {
                providers[instance.id] = controller.createProvider(instance);
            });
            set({ providers });
            console.log('Providers created for initialized instances:', providers);
            get().setInitializedInstances(initializedInstances);
        } catch (error) {
            console.error('Error initializing controller:', error);
            if (error instanceof Error) {
                notifyError(`Failed to initialize controller: ${error.message}`, error);
            }
            throw error; // Re-throw the error to handle it in the calling code
        } finally {
            set({ isInitialized: true });
        }
    },

    controllerParams: {},
    setControllerParams: (instanceId: string, params: ControllerParams) => {
        const currentParams = get().controllerParams;
        currentParams[instanceId] = params;
        set({ controllerParams: currentParams });
    },

    providers: {},

    supportedPlugins: [],
    setSupportedPlugins: (plugins: SupportedPlugin[]) => set({ supportedPlugins: plugins }),

    initializedInstances: [],
    setInitializedInstances: (instances: PluginInstance[]) => set({ initializedInstances: instances }),
}));
