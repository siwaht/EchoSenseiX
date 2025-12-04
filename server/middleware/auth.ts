import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.isAuthenticated()) {
            console.log("Authentication failed: User not authenticated");
            return res.status(401).json({ message: "Unauthorized" });
        }
        // console.log("Authentication successful for user:", req.user?.email || req.user?.id);
        return next();
    } catch (error) {
        console.error("Authentication middleware error:", error);
        return res.status(500).json({ message: "Authentication error" });
    }
};

export const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    const user = await storage.getUser(userId);
    if (!user?.isAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
    }
    return next();
};

export const checkPermission = (permission: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const user = await storage.getUser(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Admins have all permissions
        if (user.isAdmin) {
            return next();
        }

        // Check if user has the specific permission
        if (user.permissions && user.permissions.includes(permission)) {
            return next();
        }

        return res.status(403).json({ message: `Forbidden: Missing permission ${permission}` });
    };
};
