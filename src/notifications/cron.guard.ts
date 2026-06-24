import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

// Protects the cron endpoint. Vercel Cron automatically sends
// `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET env var is set, so
// only Vercel's scheduler (or someone holding the secret) can trigger sends.
// If CRON_SECRET is unset, the route is refused outright rather than left open.
@Injectable()
export class CronGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new UnauthorizedException('CRON_SECRET non configuré');
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['authorization'];
    if (header !== `Bearer ${secret}`) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
