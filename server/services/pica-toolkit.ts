import { Pica } from "@picahq/toolkit";

console.log("[Pica Toolkit] Initializing Pica toolkit...");

// Initialize Pica with secret key from environment
// We export a function to get the instance to ensure it's initialized with the fresh env var if setup order matters,
// but usually a singleton pattern is fine if env is loaded.
export const pica = new Pica(process.env.PICA_SECRET_KEY || "", {
    connectors: ["*"], // Use all available connectors
    actions: ["*"] // Use all available actions
});

export const isPicaConfigured = () => {
    return !!process.env.PICA_SECRET_KEY;
};
