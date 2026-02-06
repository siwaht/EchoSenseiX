import { IProvider, ProviderType } from "./types";
import logger from "../../utils/logger";

class ProviderRegistry {
    private providers: Map<string, IProvider> = new Map();

    register(provider: IProvider) {
        if (this.providers.has(provider.id)) {
            logger.warn(`Overwriting existing provider: ${provider.id}`);
        }
        logger.debug(`Registering provider: ${provider.id} (${provider.type})`);
        this.providers.set(provider.id, provider);
    }

    getProvider<T extends IProvider>(id: string): T {
        const provider = this.providers.get(id);
        if (!provider) {
            const byType = this.getProvidersByType(id as ProviderType);
            if (byType.length > 0) {
                return byType[0] as T;
            }
            throw new Error(`Provider '${id}' not found. Ensure it is initialized.`);
        }
        return provider as T;
    }

    getProvidersByType<T extends IProvider>(type: ProviderType): T[] {
        return Array.from(this.providers.values())
            .filter(p => p.type === type) as T[];
    }

    getDefaultProvider<T extends IProvider>(type: ProviderType): T {
        const providers = this.getProvidersByType<T>(type);
        if (providers.length === 0) {
            throw new Error(`No providers found for type '${type}'`);
        }
        return providers[0];
    }

    hasProvider(id: string): boolean {
        return this.providers.has(id);
    }

    getAllProviders(): IProvider[] {
        return Array.from(this.providers.values());
    }
}

export const providerRegistry = new ProviderRegistry();
