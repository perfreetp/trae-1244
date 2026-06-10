import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../../entities/user.entity';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersRepo.findOne({ where: { username: dto.username } });
    if (!user) throw new UnauthorizedException('用户名或密码错误');
    if (!user.active) throw new UnauthorizedException('账号已被禁用');
    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('用户名或密码错误');
    const token = this.jwtService.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
      clientId: user.clientId,
    });
    return {
      accessToken: token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        clientId: user.clientId,
      },
    };
  }

  async register(dto: RegisterDto) {
    const exists = await this.usersRepo.findOne({ where: { username: dto.username } });
    if (exists) throw new ConflictException('用户名已存在');
    const hashed = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepo.create({
      username: dto.username,
      password: hashed,
      name: dto.name,
      role: dto.role || UserRole.COLLECTOR,
      clientId: dto.clientId,
    });
    const saved = await this.usersRepo.save(user);
    return {
      id: saved.id,
      username: saved.username,
      name: saved.name,
      role: saved.role,
      clientId: saved.clientId,
    };
  }
}
