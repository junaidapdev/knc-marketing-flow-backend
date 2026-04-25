import 'express-serve-static-core';
import type { AuthenticatedUser } from '../domain/user';

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
    user?: AuthenticatedUser;
  }
}
