import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @BusinessId() businessId: string,
    @CurrentUser() user: { id: string },
    @Query('unread') unread?: string,
  ) {
    return this.notifications.listNotifications(businessId, user.id, unread === 'true');
  }

  @Get('unread/count')
  unreadCount(
    @BusinessId() businessId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.notifications.getUnreadCount(businessId, user.id).then(count => ({ count }));
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.notifications.markRead(id, user.id);
  }

  @Patch('read-all')
  markAllRead(
    @BusinessId() businessId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.notifications.markAllRead(businessId, user.id);
  }
}
