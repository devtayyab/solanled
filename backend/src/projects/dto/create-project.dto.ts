import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ example: 'City Center Signage Installation' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'LED signage installation for main storefront', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 51.5074, required: false })
  @IsNumber()
  @IsOptional()
  gps_lat?: number;

  @ApiProperty({ example: -0.1278, required: false })
  @IsNumber()
  @IsOptional()
  gps_lng?: number;

  @ApiProperty({ example: '123 Main Street, London', required: false })
  @IsString()
  @IsOptional()
  location_address?: string;

  @ApiProperty({ example: 'Site is accessible 9am-5pm', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
