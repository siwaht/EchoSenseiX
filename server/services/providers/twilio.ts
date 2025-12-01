import { ITelephonyProvider, ProviderType } from "./types";
import Twilio from "twilio";

export class TwilioProvider implements ITelephonyProvider {
    id = "twilio";
    name = "Twilio";
    type: ProviderType = "telephony";
    private client: any;

    async initialize(config: any): Promise<void> {
        this.client = Twilio(config.accountSid, config.authToken);
    }

    async getPhoneNumbers(): Promise<any[]> {
        if (!this.client) throw new Error("TwilioProvider not initialized");

        try {
            const incomingPhoneNumbers = await this.client.incomingPhoneNumbers.list();
            return incomingPhoneNumbers.map((number: any) => ({
                id: number.sid,
                phoneNumber: number.phoneNumber,
                friendlyName: number.friendlyName,
                capabilities: number.capabilities
            }));
        } catch (error: any) {
            throw new Error(`Failed to fetch phone numbers: ${error.message}`);
        }
    }

    async createPhoneNumber(data: any): Promise<any> {
        if (!this.client) throw new Error("TwilioProvider not initialized");

        try {
            // This usually involves searching and buying, simplifying for now
            const number = await this.client.incomingPhoneNumbers.create({
                phoneNumber: data.phoneNumber,
                voiceUrl: data.voiceUrl
            });
            return {
                id: number.sid,
                phoneNumber: number.phoneNumber,
                status: 'active'
            };
        } catch (error: any) {
            throw new Error(`Failed to create phone number: ${error.message}`);
        }
    }

    async deletePhoneNumber(phoneNumberId: string): Promise<any> {
        if (!this.client) throw new Error("TwilioProvider not initialized");

        try {
            await this.client.incomingPhoneNumbers(phoneNumberId).remove();
            return { success: true };
        } catch (error: any) {
            throw new Error(`Failed to delete phone number: ${error.message}`);
        }
    }

    async makeOutboundCall(to: string, from: string, config: any): Promise<any> {
        if (!this.client) throw new Error("TwilioProvider not initialized");

        try {
            const call = await this.client.calls.create({
                to,
                from,
                url: config.url || config.twiml,
                ...config
            });
            return {
                id: call.sid,
                status: call.status,
                to: call.to,
                from: call.from
            };
        } catch (error: any) {
            throw new Error(`Failed to make outbound call: ${error.message}`);
        }
    }
}
