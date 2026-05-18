import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { BusinessService } from './business.service';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { IsString, IsOptional, IsArray } from 'class-validator';

class CreateBusinessDto {
  @IsString() name!: string;
  @IsOptional() @IsString() industry?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() goals?: string[];
  @IsOptional() @IsString() timezone?: string;
}

class UpdateBusinessDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() industry?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() goals?: string[];
  @IsOptional() @IsString() timezone?: string;
}

@ApiTags('business')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('businesses')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.businessService.getUserBusinesses(user.id);
  }

  @Get('dashboard')
  dashboard(@BusinessId() businessId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.businessService.getDashboardStats(businessId);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.businessService.getBusiness(id, user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBusinessDto) {
    return this.businessService.createBusiness(user.id, dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateBusinessDto) {
    return this.businessService.updateBusiness(id, user.id, dto);
  }

  @Post('onboarding/:step')
  completeStep(@CurrentUser() user: AuthenticatedUser, @Param('step') step: string) {
    return this.businessService.completeOnboardingStep(user.id, parseInt(step));
  }
}
