import { PluginInstance, SupportedPlugin } from 'src/plugins_engine/types';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { QueryProvider } from '~core/common/interface';
import { notifyError } from '~core/notifyError';
import { ApiController } from '~core/store/ApiController';
import { StreamConnection } from '~lib/network';



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

export const appStore = createStore<ApplicationStore>((set, get) => ({
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

export const useApplicationStore = <T>(selector: (state: ApplicationStore) => T): T => {
    return useStore(appStore, selector);
};