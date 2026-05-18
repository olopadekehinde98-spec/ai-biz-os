import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  stats(@CurrentUser() user: { email: string }) {
    this.admin.assertAdmin(user.email);
    return this.admin.getStats();
  }

  @Get('users')
  users(
    @CurrentUser() user: { email: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.admin.assertAdmin(user.email);
    return this.admin.getUsers(page ? parseInt(page) : 1, limit ? parseInt(limit) : 50);
  }

  @Put('users/:id/plan')
  updatePlan(
    @CurrentUser() user: { email: string },
    @Param('id') id: string,
    @Body() body: { plan: string },
  ) {
    this.admin.assertAdmin(user.email);
    return this.admin.updateUserPlan(id, body.plan);
  }

  @Get('prompts')
  getPrompts(@CurrentUser() user: { email: string }) {
    this.admin.assertAdmin(user.email);
    return this.admin.getPrompts();
  }

  @Post('prompts')
  upsertPrompt(
    @CurrentUser() user: { email: string },
    @Body() body: { name: string; content: string },
  ) {
    this.admin.assertAdmin(user.email);
    return this.admin.upsertPrompt(body);
  }

  @Get('failed-api-calls')
  failedApiCalls(@CurrentUser() user: { email: string }, @Query('limit') limit?: string) {
    this.admin.assertAdmin(user.email);
    return this.admin.getFailedApiCalls(limit ? parseInt(limit) : 100);
  }

  @Get('ai-costs')
  aiCosts(@CurrentUser() user: { email: string }, @Query('days') days?: string) {
    this.admin.assertAdmin(user.email);
    return this.admin.getAiCostBreakdown(days ? parseInt(days) : 30);
  }
}
