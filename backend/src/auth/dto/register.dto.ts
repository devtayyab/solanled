import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  full_name: string;

  @ApiProperty({ example: 'Acme Signs Ltd', required: false })
  @IsString()
  @IsOptional()
  company_name?: string;

  @ApiProperty({ example: 'en', required: false })
  @IsString()
  @IsOptional()
  language?: string;
}
