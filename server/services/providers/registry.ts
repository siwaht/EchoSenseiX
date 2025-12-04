import { IProvider, ProviderType } from "./types";

class ProviderRegistry {
    private providers: Map<string, IProvider> = new Map();

    /**
     * Register a new provider instance.
     * @param provider The initialized provider instance
     */
    register(provider: IProvider) {
        if (this.providers.has(provider.id)) {
            console.warn(`[ProviderRegistry] Overwriting existing provider: ${provider.id}`);
        }
        console.log(`[ProviderRegistry] Registering provider: ${provider.id} (${provider.type})`);
        this.providers.set(provider.id, provider);
    }

    /**
     * Retrieve a specific provider by ID.
     */
    getProvider<T extends IProvider>(id: string): T {
        const provider = this.providers.get(id);
        if (!provider) {
            // Fallback: check if the ID matches a generic type request
            const byType = this.getProvidersByType(id as ProviderType);
            if (byType.length > 0) {
                return byType[0] as T;
            }
            throw new Error(`Provider with ID '${id}' not found. Ensure it is initialized in config.`);
        }
        return provider as T;
    }

    /**
     * Get all providers of a specific type (e.g., all 'llm' providers).
     */
    getProvidersByType<T extends IProvider>(type: ProviderType): T[] {
        return Array.from(this.providers.values())
            .filter(p => p.type === type) as T[];
    }

    /**
     * Get the default provider for a type (first registered).
     */
    getDefaultProvider<T extends IProvider>(type: ProviderType): T {
        const providers = this.getProvidersByType<T>(type);
        if (providers.length === 0) {
            throw new Error(`No providers found for type '${type}'`);
        }
        return providers[0] as T;
    }

    getAllProviders(): IProvider[] {
        return Array.from(this.providers.values());
    }
}

export const providerRegistry = new ProviderRegistry();
