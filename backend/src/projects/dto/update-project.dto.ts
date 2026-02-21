import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProjectDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: ['pending', 'in_progress', 'installed', 'completed', 'cancelled'], required: false })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  gps_lat?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  gps_lng?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  location_address?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
