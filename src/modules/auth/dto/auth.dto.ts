import { IsString, IsEnum, IsOptional, MinLength } from 'class-validator';
import { UserRole } from '../../../entities/user.entity';

export class LoginDto {
  @IsString()
  username: string;

  @IsString()
  password: string;
}

export class RegisterDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  name: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @IsString()
  @IsOptional()
  clientId?: string;
}
