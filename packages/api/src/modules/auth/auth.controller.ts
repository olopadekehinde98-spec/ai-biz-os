import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from './jwt.strategy';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    const userData = await this.authService.getUser(user.id);
    const onboarding = await this.authService.getUserOnboarding(user.id);
    return { user: userData, onboarding };
  }

  @Post('sync')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async syncUser(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.syncUser(user.id, user.email);
  }
}
