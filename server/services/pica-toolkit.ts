import { Pica } from "@picahq/toolkit";

export class PicaToolkitService {
    private pica: Pica;

    constructor(apiKey: string) {
        this.pica = new Pica(apiKey, {
            connectors: ["*"],
            actions: ["*"]
        });
    }

    get instance(): Pica {
        return this.pica;
    }
}
