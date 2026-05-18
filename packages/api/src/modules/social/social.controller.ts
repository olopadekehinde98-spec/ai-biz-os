import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { SocialService } from './social.service';
import type { PostStatus } from '@ai-biz-os/shared';

@ApiTags('social')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('social')
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @Get('posts')
  list(@BusinessId() businessId: string, @Query('status') status?: PostStatus) {
    return this.social.listPosts(businessId, status);
  }

  @Get('posts/:id')
  get(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.social.getPost(businessId, id);
  }

  @Post('posts')
  create(
    @BusinessId() businessId: string,
    @Body() body: { platform: string; content: string; media_urls?: string[]; scheduled_at?: string },
  ) {
    return this.social.createPost(businessId, body);
  }

  @Put('posts/:id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: { content?: string; scheduled_at?: string; status?: PostStatus; media_urls?: string[] },
  ) {
    return this.social.updatePost(businessId, id, body);
  }

  @Delete('posts/:id')
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.social.deletePost(businessId, id);
  }

  @Post('generate')
  generate(
    @BusinessId() businessId: string,
    @Body() body: { platform: string; topic: string; tone?: string; schedule_at?: string },
  ) {
    return this.social.generateContent(businessId, body);
  }

  @Get('accounts')
  accounts(@BusinessId() businessId: string) {
    return this.social.getConnectedAccounts(businessId);
  }
}
