
import "dotenv/config";
import { storage } from "../storage";
import { scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

const ADMIN_EMAIL = "cc@siwaht.com";
const ADMIN_PASSWORD = "Hola173!"; // The expected password

async function verifyAdmin() {
    console.log(`Verifying admin user: ${ADMIN_EMAIL}`);
    const user = await storage.getUserByEmail(ADMIN_EMAIL);

    if (!user) {
        console.error("❌ Admin user not found!");
        process.exit(1);
    }

    console.log("✅ Admin user found.");

    if (!user.isAdmin) {
        console.error("❌ User found but is NOT an admin!");
        process.exit(1);
    }
    console.log("✅ User has admin privileges.");

    if (!user.password) {
        console.error("❌ User has no password set!");
        process.exit(1);
    }

    // Verify password
    try {
        const isMatch = await comparePasswords(ADMIN_PASSWORD, user.password);
        if (isMatch) {
            console.log("✅ Password matches expected value.");
        } else {
            console.error("❌ Password does NOT match expected value.");
            process.exit(1);
        }
    } catch (error) {
        console.error("❌ Error verifying password:", error);
        process.exit(1);
    }

    console.log("SUCCESS: Admin credentials verified.");
    process.exit(0);
}

// Copied from auth.ts since it's not exported
async function comparePasswords(supplied: string, stored: string) {
    if (!stored || !stored.includes('.')) {
        return false;
    }

    const [hashed, salt] = stored.split(".");

    if (!hashed || !salt) {
        return false;
    }

    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
}

verifyAdmin().catch(console.error);
