import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const CurrentUser = createParamDecorator((_, ctx: ExecutionContext) => {
  const gctx = GqlExecutionContext.create(ctx);
  return gctx.getContext().req.user;
});
