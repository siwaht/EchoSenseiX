import { IProvider, ProviderType } from "./types";

class ProviderRegistry {
    private providers: Map<string, IProvider> = new Map();

    register(provider: IProvider) {
        console.log(`[ProviderRegistry] Registering provider: ${provider.id} (${provider.type})`);
        this.providers.set(provider.id, provider);
    }

    getProvider<T extends IProvider>(id: string): T {
        const provider = this.providers.get(id);
        if (!provider) {
            throw new Error(`Provider with ID '${id}' not found.`);
        }
        return provider as T;
    }

    getProvidersByType(type: ProviderType): IProvider[] {
        return Array.from(this.providers.values()).filter(p => p.type === type);
    }

    getAllProviders(): IProvider[] {
        return Array.from(this.providers.values());
    }
}

export const providerRegistry = new ProviderRegistry();
