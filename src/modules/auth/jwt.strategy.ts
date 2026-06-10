import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'data-collection-secret-key-2024',
    });
  }

  async validate(payload: any) {
    const user = await this.usersRepo.findOne({ where: { id: payload.sub } });
    if (!user || !user.active) return null;
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      clientId: user.clientId,
    };
  }
}
