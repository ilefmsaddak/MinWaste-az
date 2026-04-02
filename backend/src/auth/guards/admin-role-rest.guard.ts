import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { FirebaseAuthService } from '../firebase-auth.service';
import { UsersService } from '../../users/users.service';

@Injectable()
export class AdminRoleRestGuard implements CanActivate {
  constructor(
    private readonly firebaseAuth: FirebaseAuthService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers?.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Authorization bearer token');
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Missing Authorization bearer token');
    }

    const decoded = await this.firebaseAuth.verifyIdToken(token);
    const dbUser = await this.usersService.upsertFromFirebase({
      uid: decoded.uid,
      email: decoded.email,
      name: (decoded as { name?: string }).name,
    });

    if (String(dbUser.role).toUpperCase() !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    req.dbUser = dbUser;
    return true;
  }
}
