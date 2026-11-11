import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async login(dto: LoginDto) {
    const username = dto.username.trim().toLowerCase();

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('role.permissions', 'permissions')
      .where('LOWER(user.username) = LOWER(:username)', { username })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Username or password is incorrect.');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('This user account is inactive.');
    }

    if (!user.role || !user.role.isActive) {
      throw new UnauthorizedException('The assigned role is inactive.');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Username or password is incorrect.');
    }

    const normalizedRoleName = user.role.name.trim().toLowerCase();
    const hasAdminRoleName =
      normalizedRoleName === 'admin' ||
      normalizedRoleName === 'super admin' ||
      normalizedRoleName.includes('administrator');

    const hasAdministrationPermission = user.role.permissions?.some(
      (permission) =>
        permission.canView &&
        (permission.module === 'User Management' ||
          permission.module === 'Role Management'),
    );

    const accessRole: 'Admin' | 'Agent' =
      hasAdminRoleName || hasAdministrationPermission ? 'Admin' : 'Agent';

    return {
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        status: user.status,
      },
      role: {
        id: user.role.id,
        name: user.role.name,
      },
      accessRole,
    };
  }
}
