import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SupabaseProvider } from '../../providers/supabase.provider';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  accessToken: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly supabase: SupabaseProvider) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env['SUPABASE_JWT_SECRET'] ?? process.env['NEXTAUTH_SECRET'] ?? '',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<AuthenticatedUser> {
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req as any);
    if (!token) throw new UnauthorizedException();

    const { data: { user }, error } = await this.supabase.getClient().auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return {
      id: user.id,
      email: user.email ?? '',
      role: user.role ?? 'authenticated',
      accessToken: token,
    };
  }
}
