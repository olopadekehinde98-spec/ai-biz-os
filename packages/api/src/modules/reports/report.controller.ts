import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { ReportService } from './report.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get()
  list(@BusinessId() businessId: string) {
    return this.reportService.getReports(businessId);
  }

  @Get(':id')
  get(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.reportService.getReport(businessId, id);
  }

  @Post('generate')
  generate(@BusinessId() businessId: string) {
    return this.reportService.generateReport(businessId);
  }

  @Post(':id/send')
  send(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.reportService.sendReport(id, businessId);
  }
}
