import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { User, UserRole } from '../../modules/users/users.interface';
import { CardholdersService } from '../../modules/card_holders';
import { CardsService } from '../../modules/cards';
import { CreateCardholderDto } from '../../modules/card_holders';
import { CreateCardDto } from '../../modules/cards';
import { CardholderResponseDto } from '../../modules/card_holders';
import { CardResponseDto } from '../../modules/cards';
import { Cardholder } from '../../modules/card_holders';
import { Card } from '../../modules/cards';
import { Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';

@ApiTags('Issuing')
@Controller('ops/issuing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OPS_ADMIN, UserRole.USER) // TODO: Remove USER role when deploy prod
@ApiBearerAuth()
export class OpsIssuingController {
  constructor(
    private readonly cardholdersService: CardholdersService,
    private readonly cardsService: CardsService,
  ) {}

  @Post('cardholders')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new cardholder' })
  @ApiResponse({
    status: 201,
    description: 'Cardholder created successfully',
    type: CardholderResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'Cardholder already exists' })
  async createCardholder(
    @CurrentUser() user: User,
    @Body() dto: CreateCardholderDto,
  ): Promise<Cardholder> {
    return this.cardholdersService.createCardholder(user.id, dto);
  }

  @Get('cardholders/me')
  @ApiOperation({ summary: 'Get current user cardholder' })
  @ApiResponse({ status: 200, description: 'Cardholder found', type: CardholderResponseDto })
  @ApiResponse({ status: 404, description: 'Cardholder not found' })
  async getMyCardholder(@CurrentUser() user: User): Promise<Cardholder> {
    return this.cardholdersService.getCardholderByUserId(user.id);
  }

  @Get('cardholders/:id')
  @ApiOperation({ summary: 'Get cardholder by ID' })
  @ApiResponse({ status: 200, description: 'Cardholder found', type: CardholderResponseDto })
  @ApiResponse({ status: 404, description: 'Cardholder not found' })
  async getCardholder(@Param('id') id: string): Promise<Cardholder> {
    return this.cardholdersService.getCardholderById(id);
  }

  @Post('cards')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new virtual card' })
  @ApiResponse({ status: 201, description: 'Card created successfully', type: CardResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Cardholder or case not found' })
  @ApiResponse({ status: 409, description: 'Card already exists for this case' })
  async createCard(@CurrentUser() user: User, @Body() dto: CreateCardDto): Promise<Card> {
    return this.cardsService.createCard(user.id, dto);
  }

  @Get('cards/:id')
  @ApiOperation({ summary: 'Get card by ID' })
  @ApiResponse({ status: 200, description: 'Card found', type: CardResponseDto })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async getCard(@Param('id') id: string): Promise<Card> {
    return this.cardsService.getCardById(id);
  }

  @Get('cards/case/:caseId')
  @ApiOperation({ summary: 'Get card by case ID' })
  @ApiResponse({ status: 200, description: 'Card found', type: CardResponseDto })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async getCardByCaseId(@Param('caseId') caseId: string): Promise<Card> {
    return this.cardsService.getCardByCaseId(caseId);
  }

  @Get('cardholders/:cardholderId/cards')
  @ApiOperation({ summary: 'Get all cards for a cardholder' })
  @ApiResponse({ status: 200, description: 'Cards found', type: [CardResponseDto] })
  async getCardsByCardholder(@Param('cardholderId') cardholderId: string): Promise<Card[]> {
    return this.cardsService.getCardsByCardholderId(cardholderId);
  }
}
