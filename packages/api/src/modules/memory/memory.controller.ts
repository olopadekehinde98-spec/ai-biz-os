import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { MemoryService } from './memory.service';
import { IsString, IsIn, IsNumber, IsOptional, Min, Max } from 'class-validator';

class AddMemoryDto {
  @IsString() content!: string;
  @IsIn(['fact', 'preference', 'goal', 'event', 'insight']) memory_type!: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1) importance_score?: number;
}

@ApiTags('memory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('memory')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Get()
  list(@BusinessId() businessId: string) {
    return this.memoryService.listMemories(businessId);
  }

  @Post()
  add(@BusinessId() businessId: string, @Body() dto: AddMemoryDto) {
    return this.memoryService.addMemory(
      businessId,
      dto.content,
      dto.memory_type as any,
      dto.importance_score,
    );
  }

  @Delete(':id')
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.memoryService.deleteMemory(businessId, id);
  }
}
