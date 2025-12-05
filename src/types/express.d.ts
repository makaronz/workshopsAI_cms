
import { UserRole } from '../services/authService';

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                role: UserRole | string;
                name: string;
                sessionId: string;
                isActive?: boolean;
                lastLoginAt?: Date | null;
            };
            session?: {
                id: string;
                ip: string;
                userAgent: string;
                csrfToken?: string;
            };
        }
    }
}
