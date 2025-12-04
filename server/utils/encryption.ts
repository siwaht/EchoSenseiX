import crypto from "crypto";
import process from "process";

// Generic encryption function for credentials
export function encryptCredentials(data: any): string {
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    const algorithm = "aes-256-cbc";
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || "default-key", "salt", 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(dataStr, "utf8", "hex");
    encrypted += cipher.final("hex");

    return `${iv.toString("hex")}:${encrypted}`;
}

// Generic decryption function for credentials
export function decryptCredentials(encryptedData: string): any {
    try {
        const algorithm = "aes-256-cbc";
        const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || "default-key", "salt", 32);

        // Handle both old and new encryption formats
        if (!encryptedData.includes(":")) {
            // Old format detected - use legacy decryption (deprecated method)
            console.warn("WARNING: Old encryption format detected. Please re-save credentials to use secure encryption.");

            // Using deprecated createDecipher for backward compatibility only
            // This should be migrated to createDecipheriv
            const decipher = crypto.createDecipher("aes-256-cbc", process.env.ENCRYPTION_KEY || "default-key");
            let decrypted = decipher.update(encryptedData, "hex", "utf8");
            decrypted += decipher.final("utf8");
            try {
                return JSON.parse(decrypted);
            } catch {
                return decrypted;
            }
        }

        // New format
        const parts = encryptedData.split(":");
        const ivHex = parts[0] || "";
        const encrypted = parts[1] || "";
        const iv = Buffer.from(ivHex, "hex");

        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted: string = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");

        try {
            return JSON.parse(decrypted);
        } catch {
            return decrypted;
        }
    } catch (error) {
        console.error("Decryption failed:", error);
        throw new Error("Failed to decrypt credentials. Please re-enter your credentials.");
    }
}

export function encryptApiKey(apiKey: string): string {
    const algorithm = "aes-256-cbc";
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || "default-key", "salt", 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(apiKey, "utf8", "hex");
    encrypted += cipher.final("hex");

    return `${iv.toString("hex")}:${encrypted}`;
}

export function decryptApiKey(encryptedApiKey: string): string {
    try {
        const algorithm = "aes-256-cbc";
        const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || "default-key", "salt", 32);

        // Handle both old and new encryption formats
        if (!encryptedApiKey.includes(":")) {
            // Old format detected - use legacy decryption (deprecated method)
            console.warn("WARNING: Old encryption format detected. Please re-save API key to use secure encryption.");

            // Using deprecated createDecipher for backward compatibility only
            // This should be migrated to createDecipheriv
            const decipher = crypto.createDecipher("aes-256-cbc", process.env.ENCRYPTION_KEY || "default-key");
            let decrypted = decipher.update(encryptedApiKey, "hex", "utf8");
            decrypted += decipher.final("utf8");
            return decrypted;
        }

        // New format
        const parts = encryptedApiKey.split(":");
        const ivHex = parts[0] || "";
        const encrypted = parts[1] || "";
        const iv = Buffer.from(ivHex, "hex");

        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted: string = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");

        return decrypted;
    } catch (error) {
        console.error("Decryption failed:", error);
        throw new Error("Failed to decrypt API key. Please re-enter your API key.");
    }
}
