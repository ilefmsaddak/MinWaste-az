import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { FirebaseAuthService } from '../firebase-auth.service';

@Injectable()
export class FirebaseGqlGuard implements CanActivate {
  constructor(private readonly firebaseAuth: FirebaseAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const req = ctx.getContext().req;

    const authHeader: string | undefined = req.headers?.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Authorization bearer token');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token)
      throw new UnauthorizedException('Missing Authorization bearer token');
    const decoded = await this.firebaseAuth.verifyIdToken(token);

    req.user = decoded; // { uid, email, name, ... }
    return true;
  }
}
