import { Test, TestingModule } from '@nestjs/testing';
import * as crypto from 'crypto';
import { LoggerModule } from '../../common/infrastructure/logger';
import { AirwallexConfigService } from '../airwallex';
import { CardsService } from '../cards';
import { WebhookEventsRepository } from './webhook-events.repository';
import { CardTransactionsRepository } from './card-transactions.repository';
import { SettlementsRepository } from '../settlements/settlements.repository';
import { WebhooksService } from './webhooks.service';
import type { WebhookEventRecord, CardTransactionRecord } from './webhooks.interface';
import { Card, CardStatus } from '../cards/interfaces/card.interface';
import { CasesService, CaseStatus, Case, ReasonCategory } from '../cases';
import { AuditLogsService } from '../audit-logs';

function sign(secret: string, timestamp: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}${body}`).digest('hex');
}

describe('WebhooksService', () => {
  let service: WebhooksService;
  let webhookEventsRepo: jest.Mocked<WebhookEventsRepository>;
  let cardTransactionsRepo: jest.Mocked<CardTransactionsRepository>;
  let cardsService: jest.Mocked<CardsService>;
  let casesService: jest.Mocked<CasesService>;
  let auditLogsService: jest.Mocked<AuditLogsService>;
  const secret = 'test-webhook-secret';

  beforeEach(async () => {
    const airwallexConfig = {
      webhookSecret: secret,
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule],
      providers: [
        WebhooksService,
        {
          provide: AirwallexConfigService,
          useValue: airwallexConfig,
        },
        {
          provide: WebhookEventsRepository,
          useValue: {
            create: jest.fn(),
            findBySourceAndEventId: jest.fn(),
            updateStatus: jest.fn(),
            incrementRetryCount: jest.fn(),
          },
        },
        {
          provide: CardTransactionsRepository,
          useValue: {
            create: jest.fn(),
            findByAirwallexTxnId: jest.fn(),
          },
        },
        {
          provide: CardsService,
          useValue: {
            getCardByAirwallexId: jest.fn(),
            incrementUsedAmount: jest.fn(),
          },
        },
        {
          provide: CasesService,
          useValue: {
            getCaseById: jest.fn(),
            updateCaseStatus: jest.fn(),
          },
        },
        {
          provide: AuditLogsService,
          useValue: {
            log: jest.fn(),
          },
        },
        {
          provide: SettlementsRepository,
          useValue: {
            findByAirwallexPaymentLinkId: jest.fn(),
            updateStatus: jest.fn(),
            setCompletedAt: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    webhookEventsRepo = module.get(WebhookEventsRepository);
    cardTransactionsRepo = module.get(CardTransactionsRepository);
    cardsService = module.get(CardsService);
    casesService = module.get(CasesService);
    auditLogsService = module.get(AuditLogsService);
  });

  describe('verifySignature', () => {
    it('returns true for valid signature', () => {
      const ts = String(Date.now());
      const body = '{"id":"evt_1","name":"issuing.transaction.succeeded","data":{}}';
      const sig = sign(secret, ts, body);
      const raw = Buffer.from(body, 'utf8');
      expect(service.verifySignature(raw, ts, sig)).toBe(true);
    });

    it('returns false for invalid signature', () => {
      const ts = String(Date.now());
      const body = '{"id":"evt_1","name":"issuing.transaction.succeeded"}';
      const raw = Buffer.from(body, 'utf8');
      expect(service.verifySignature(raw, ts, 'invalid')).toBe(false);
    });

    it('returns false when payload differs', () => {
      const ts = String(Date.now());
      const body = '{"id":"evt_1"}';
      const sig = sign(secret, ts, body);
      const raw = Buffer.from('{"id":"evt_2"}', 'utf8');
      expect(service.verifySignature(raw, ts, sig)).toBe(false);
    });
  });

  describe('processWebhook', () => {
    const ts = String(Date.now());
    const payload = {
      id: 'evt_123',
      name: 'issuing.transaction.succeeded',
      data: {
        transaction_id: 'txn_abc',
        card_id: 'card_airwallex_1',
        transaction_amount: 100,
        transaction_currency: 'VND',
        event_type: 'CLEARING',
        merchant: { name: 'Test Merchant', postcode: '', state: '', city: '' },
        posted_date: new Date().toISOString(),
        status: 'APPROVED',
        masked_card_number: '****1234',
      },
      created_at: new Date().toISOString(),
    };
    const body = JSON.stringify(payload);
    const sig = sign(secret, ts, body);
    const headers = { 'x-timestamp': ts, 'x-signature': sig };

    it('rejects missing signature headers', async () => {
      const res = await service.processWebhook(Buffer.from(body, 'utf8'), {});
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.status).toBe(401);
    });

    it('rejects invalid signature', async () => {
      const res = await service.processWebhook(Buffer.from(body, 'utf8'), {
        'x-timestamp': ts,
        'x-signature': 'wrong',
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.status).toBe(401);
    });

    it('accepts valid webhook and processes', async () => {
      webhookEventsRepo.findBySourceAndEventId.mockResolvedValue(null);
      webhookEventsRepo.create.mockResolvedValue({
        id: 'we_1',
        source: 'airwallex',
        eventId: payload.id,
        eventType: payload.name,
        payload: payload as unknown as Record<string, unknown>,
        status: 'RECEIVED',
        errorMessage: null,
        retryCount: 0,
        processedAt: null,
        createdAt: new Date(),
      });
      const mockCard: Card = {
        id: 'card_uuid_1',
        caseId: 'c1',
        cardholderId: 'ch1',
        airwallexCardId: 'card_airwallex_1',
        status: CardStatus.ACTIVE,
        limitAmount: 10000,
        limitCurrency: 'VND',
        usedAmount: 0,
        activeFrom: new Date(),
        activeTo: new Date(),
        authorizationControls: {},
        createdAt: new Date(),
      };
      cardsService.getCardByAirwallexId.mockResolvedValue(mockCard);
      cardTransactionsRepo.findByAirwallexTxnId.mockResolvedValue(null);
      cardTransactionsRepo.create.mockResolvedValue({
        id: 'ct1',
        cardId: mockCard.id,
        airwallexTxnId: 'txn_abc',
        amount: 100,
        currency: 'VND',
        merchantName: null,
        merchantCategory: null,
        status: 'SUCCEEDED',
        authorizationCode: null,
        transactionAt: new Date(),
        createdAt: new Date(),
      } as CardTransactionRecord);
      const mockCase: Case = {
        id: 'c1',
        userId: 'u1',
        status: CaseStatus.CARD_ISSUED,
        hospitalName: 'Test Hospital',
        plannedVisitAt: new Date(),
        reasonCategory: ReasonCategory.OTHER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      casesService.getCaseById.mockResolvedValue(mockCase);
      casesService.updateCaseStatus.mockResolvedValue({
        ...mockCase,
        status: CaseStatus.PAID,
      });
      auditLogsService.log.mockResolvedValue({
        id: 'log_1',
        actorId: 'airwallex',
        actorType: 'system',
        action: 'STATUS_CHANGED',
        entityType: 'case',
        entityId: 'c1',
        beforeState: null,
        afterState: null,
        createdAt: new Date(),
      });

      const res = await service.processWebhook(Buffer.from(body, 'utf8'), headers);

      expect(res.ok).toBe(true);
      expect(webhookEventsRepo.create).toHaveBeenCalledWith({
        source: 'airwallex',
        eventId: payload.id,
        eventType: payload.name,
        payload: expect.any(Object),
      });
      expect(cardTransactionsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          airwallexTxnId: 'txn_abc',
          amount: 100,
          currency: 'VND',
          status: 'SUCCEEDED',
        }),
      );
      expect(cardsService.incrementUsedAmount).toHaveBeenCalledWith('card_uuid_1', 100);
      expect(casesService.getCaseById).toHaveBeenCalledWith('c1');
      expect(casesService.updateCaseStatus).toHaveBeenCalledWith(
        'c1',
        CaseStatus.PAID,
        'airwallex',
      );
      expect(auditLogsService.log).toHaveBeenCalled();
    });

    it('returns duplicate when event already processed', async () => {
      const existing: WebhookEventRecord = {
        id: 'we_1',
        source: 'airwallex',
        eventId: payload.id,
        eventType: payload.name,
        payload: {},
        status: 'PROCESSED',
        errorMessage: null,
        retryCount: 0,
        processedAt: new Date(),
        createdAt: new Date(),
      };
      webhookEventsRepo.findBySourceAndEventId.mockResolvedValue(existing);

      const res = await service.processWebhook(Buffer.from(body, 'utf8'), headers);

      expect(res.ok).toBe(true);
      expect(res.ok && 'duplicate' in res && res.duplicate).toBe(true);
      expect(webhookEventsRepo.create).not.toHaveBeenCalled();
    });
  });
});
