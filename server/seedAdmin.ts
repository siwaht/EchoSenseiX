import { storage } from "./storage";
import { hashPassword } from "./auth";
import { initializeSchema } from "./init-schema";

export async function seedAdminUser() {
  try {
    console.log("[SEED] Starting admin user seeding process...");
    
    // First, ensure database schema is initialized
    await initializeSchema();
    console.log("[SEED] Database schema initialized");
    
    // Check if admin user already exists
    const existingUser = await storage.getUserByEmail("cc@siwaht.com");
    
    if (existingUser) {
      console.log("[SEED] Admin user already exists");
      return;
    }
    
    // Create admin user with properly hashed password
    const hashedPassword = await hashPassword("Hola173!");
    const adminUser = await storage.createUser({
      email: "cc@siwaht.com",
      password: hashedPassword,
      firstName: "Admin",
      lastName: "User",
      isAdmin: true,
    });
    
    console.log("[SEED] Admin user created successfully:", adminUser.email);
  } catch (error) {
    console.error("[SEED] Error seeding admin user:", error);
    // Don't throw the error to prevent server startup failure
  }
}