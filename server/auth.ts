import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { config } from "./config";
import logger from "./utils/logger";
import connectPg from "connect-pg-simple";

declare global {
  namespace Express {
    interface User extends SelectUser { }
  }
}

const scryptAsync = promisify(scrypt);

// Admin email from env — never hardcode credentials
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";

// Minimum password requirements
const PASSWORD_MIN_LENGTH = 8;

function validatePassword(password: string): { valid: boolean; message?: string } {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  return { valid: true };
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

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

export function setupAuth(app: Express) {
  const isPostgres = process.env.DATABASE_URL?.startsWith("postgres");
  let sessionStore;

  if (isPostgres) {
    const pgStore = connectPg(session);
    sessionStore = new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      ttl: 7 * 24 * 60 * 60 * 1000,
      tableName: "sessions",
    });
  } else {
    const MemoryStore = require('memorystore')(session);
    sessionStore = new MemoryStore({
      checkPeriod: 86400000
    });
  }

  // Session secret: require strong secret in production
  const sessionSecret = config.security.sessionSecret;

  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    }
  };

  // Trust proxy already set in server/index.ts — don't duplicate
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: 'email' },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user || !user.password || !(await comparePasswords(password, user.password))) {
            return done(null, false);
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, firstName, lastName, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const passwordCheck = validatePassword(password);
      if (!passwordCheck.valid) {
        return res.status(400).json({ message: passwordCheck.message });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const hashedPassword = await hashPassword(password);
      const isAdmin = ADMIN_EMAIL ? email === ADMIN_EMAIL : false;
      const user = await storage.createUser({
        email,
        firstName,
        lastName,
        password: hashedPassword,
        isAdmin,
      });

      return new Promise<void>((resolve) => {
        req.login(user, (err) => {
          if (err) {
            next(err);
          } else {
            res.status(201).json(user);
          }
          resolve();
        });
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req: Request, res: Response) => {
    res.status(200).json(req.user);
  });

  const handleLogout = (req: Request, res: Response, next: NextFunction) => {
    req.logout((err) => {
      if (err) {
        logger.error("Logout error", { error: err instanceof Error ? err.message : String(err) });
        return next(err);
      }

      // Clear cookie first, then destroy session
      res.clearCookie('connect.sid', { path: '/' });

      if (req.session) {
        req.session.destroy((destroyErr) => {
          if (destroyErr) {
            logger.error("Session destroy error", { error: destroyErr instanceof Error ? destroyErr.message : String(destroyErr) });
          }
          res.status(200).send('Logged out');
        });
      } else {
        res.status(200).send('Logged out');
      }
    });
  };

  app.get("/api/logout", handleLogout);
  app.post("/api/logout", handleLogout);

  app.get("/api/auth/user", (req: Request, res: Response) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    return res.json(req.user);
  });
}