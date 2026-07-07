import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class UserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const params = request.params;
    const body = request.body;

    // Vérifier l'ID utilisateur dans les paramètres de route
    if (params.userId && parseInt(params.userId) !== user.id) {
      throw new UnauthorizedException("Vous n'avez pas accès à ces données");
    }

    // Vérifier l'ID utilisateur dans le body (pour la création/mise à jour)
    if (body?.user_id && body.user_id !== user.id) {
      throw new UnauthorizedException(
        "Vous ne pouvez pas manipuler les données d'autres utilisateurs",
      );
    }

    return true;
  }
}
