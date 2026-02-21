import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all documents' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'language', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Query('category') category?: string,
    @Query('language') language?: string,
    @Query('search') search?: string,
  ) {
    return this.documentsService.findAll(category, language, search);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get document categories' })
  getCategories() {
    return this.documentsService.getCategories();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a document by ID' })
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }
}
