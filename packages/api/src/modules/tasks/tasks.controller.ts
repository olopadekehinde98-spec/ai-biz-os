import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { TasksService } from './tasks.service';
import type { TaskStatus, TaskPriority } from '@ai-biz-os/shared';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@BusinessId() businessId: string, @Query('status') status?: TaskStatus) {
    return this.tasks.listTasks(businessId, status);
  }

  @Get('stats')
  stats(@BusinessId() businessId: string) {
    return this.tasks.getStats(businessId);
  }

  @Get(':id')
  get(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.tasks.getTask(businessId, id);
  }

  @Post()
  create(
    @BusinessId() businessId: string,
    @Body() body: { title: string; description?: string; priority?: TaskPriority; due_date?: string },
  ) {
    return this.tasks.createTask(businessId, body);
  }

  @Put(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: Partial<{ title: string; description: string; priority: TaskPriority; status: TaskStatus; due_date: string }>,
  ) {
    return this.tasks.updateTask(businessId, id, body);
  }

  @Delete(':id')
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.tasks.deleteTask(businessId, id);
  }

  @Post('generate')
  generate(@BusinessId() businessId: string, @Body() body: { context: string }) {
    return this.tasks.generateTasks(businessId, body.context);
  }
}
