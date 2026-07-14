import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { CreateUserDto } from '../users/dto/create-user.dto';

// Sign in with Apple — audiences acceptées : bundle iOS (+ le Service ID web
// le jour où la PWA s'y met). Issuer et JWKS officiels d'Apple.
const APPLE_AUDIENCES = ['super.foody.app'];
const APPLE_ISSUER = 'https://appleid.apple.com';
const appleJwks = createRemoteJWKSet(
  new URL('https://appleid.apple.com/auth/keys'),
);

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  /// Change le mot de passe après avoir vérifié l'actuel (bcrypt). 401 si
  /// l'ancien ne correspond pas.
  async changePassword(email: string, current: string, next: string) {
    const user = await this.usersService.findByEmail(email);
    const ok = await bcrypt.compare(current, user.password);
    if (!ok) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }
    await this.usersService.update(user.id, { password: next });
    return { ok: true };
  }

  /** Vérifie l'identity token auprès des clés publiques d'Apple — extrait
   *  en méthode pour être remplacé dans les tests. */
  protected async verifyAppleToken(
    identityToken: string,
  ): Promise<{ sub: string; email?: string }> {
    try {
      const { payload } = await jwtVerify(identityToken, appleJwks, {
        issuer: APPLE_ISSUER,
        audience: APPLE_AUDIENCES,
      });
      return {
        sub: payload.sub as string,
        email: payload.email as string | undefined,
      };
    } catch {
      throw new UnauthorizedException('Jeton Apple invalide');
    }
  }

  /** Connexion / inscription « Sign in with Apple » : retrouve par apple_sub,
   *  sinon lie un compte email existant (même adresse), sinon crée le compte
   *  (mot de passe aléatoire — la session vit via Apple). */
  async appleLogin(identityToken: string, name?: string) {
    const { sub, email } = await this.verifyAppleToken(identityToken);
    const normalized = email?.trim().toLowerCase();

    let user = await this.usersService.findByAppleSub(sub);
    if (!user && normalized) {
      // findByEmail JETTE un 404 quand l'email est inconnu — ici c'est le cas
      // nominal (email en relais privé Apple, jamais vu) : on absorbe, on créera.
      const byEmail = await this.usersService
        .findByEmail(normalized)
        .catch(() => null);
      if (byEmail) {
        user = await this.usersService.linkAppleSub(byEmail.id, sub);
      }
    }
    if (!user) {
      if (!normalized) {
        throw new UnauthorizedException(
          "Apple n'a pas transmis d'email pour ce compte",
        );
      }
      const created = await this.usersService.create({
        email: normalized,
        name: name?.trim() || normalized.split('@')[0],
        password: randomBytes(24).toString('hex'),
      });
      user = await this.usersService.linkAppleSub(created.id, sub);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safe } = user as { password?: string } & Record<
      string,
      unknown
    >;
    return this.login(safe);
  }

  async register(createUserDto: CreateUserDto) {
    try {
      const user = await this.usersService.create(createUserDto);
      return user;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Cet email est déjà utilisé');
      }
      throw error;
    }
  }
}
