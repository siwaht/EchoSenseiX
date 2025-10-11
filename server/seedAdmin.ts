import { storage } from "./storage";
import { hashPassword } from "./auth";

export async function seedAdminUser() {
  try {
    // Check if admin user already exists
    const existingUser = await storage.getUserByEmail("cc@siwaht.com");
    
    if (existingUser) {
      console.log("Admin user already exists");
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
    
    console.log("Admin user created successfully:", adminUser.email);
  } catch (error) {
    console.error("Error seeding admin user:", error);
  }
}