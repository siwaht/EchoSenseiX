import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import connectPg from "connect-pg-simple";

declare global {
  namespace Express {
    interface User extends SelectUser { }
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  // Handle cases where stored password might not have the expected format
  if (!stored || !stored.includes('.')) {
    return false;
  }

  const [hashed, salt] = stored.split(".");

  // Ensure both hashed and salt exist
  if (!hashed || !salt) {
    return false;
  }

  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres");
  let sessionStore;

  if (isPostgres) {
    const pgStore = connectPg(session);
    sessionStore = new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      ttl: 7 * 24 * 60 * 60 * 1000, // 1 week
      tableName: "sessions",
    });
  } else {
    const MemoryStore = require('memorystore')(session);
    sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
  }

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "dev-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: 'email' },
      async (email, password, done) => {
        const user = await storage.getUserByEmail(email);
        if (!user) {
          return done(null, false);
        }

        // Check hashed password for all users
        if (!user.password || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        }

        return done(null, user);
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });

  app.post("/api/register", async (req, res, next) => {
    const { email, firstName, lastName, password } = req.body;

    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await hashPassword(password);
    const user = await storage.createUser({
      email,
      firstName,
      lastName,
      password: hashedPassword,
      isAdmin: email === "cc@siwaht.com",
    });

    return new Promise<void>((resolve, _reject) => {
      req.login(user, (err) => {
        if (err) {
          next(err);
          resolve();
        } else {
          res.status(201).json(user);
          resolve();
        }
      });
    });
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
  });

  // Handle both GET and POST logout for compatibility
  const handleLogout = (req: any, res: any, next: any) => {
    req.logout((err: any) => {
      if (err) {
        console.error("Error during logout:", err);
        return next(err);
      }

      // Destroy the session completely
      if (req.session) {
        req.session.destroy((destroyErr: any) => {
          if (destroyErr) {
            console.error("Error destroying session:", destroyErr);
          }
          // Clear the session cookie
          res.clearCookie('connect.sid', { path: '/' });
          // Send success response
          res.status(200).send('Logged out');
        });
      } else {
        res.status(200).send('Logged out');
      }
    });
  };

  app.get("/api/logout", handleLogout);
  app.post("/api/logout", handleLogout);

  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    return res.json(req.user);
  });
}