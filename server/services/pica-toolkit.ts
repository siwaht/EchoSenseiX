import { Pica } from "@picahq/toolkit";

console.log("[Pica Toolkit] Initializing Pica toolkit...");

export const pica = new Pica(process.env.PICA_SECRET_KEY || "", {
    connectors: ["*"],
    actions: ["*"]
});

export const isPicaConfigured = () => {
    return !!process.env.PICA_SECRET_KEY;
};
