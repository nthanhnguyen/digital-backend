import { Controller, Post, Req, Res, HttpStatus, HttpCode } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WebhooksService } from '../../modules/webhooks/webhooks.service';

/** Extended Express Request with rawBody attached by body-parser verify (for webhook signature verification). */
interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  /**
   * Airwallex webhook endpoint. No auth; verification is via HMAC signature.
   * Notification URL: https://<your-domain>/webhooks/airwallex
   */
  @Post('airwallex')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Airwallex webhook events (HMAC-verified)' })
  @ApiResponse({ status: 200, description: 'Webhook received (or duplicate)' })
  @ApiResponse({ status: 400, description: 'Missing or invalid body' })
  @ApiResponse({ status: 401, description: 'Invalid or missing signature / timestamp' })
  async handleAirwallex(@Req() req: RequestWithRawBody, @Res() res: Response): Promise<void> {
    const rawBody =
      req.rawBody ??
      (req.body && typeof req.body === 'string' ? Buffer.from(req.body, 'utf8') : null);
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      res.status(HttpStatus.BAD_REQUEST).json({
        error: 'Missing or invalid body',
        message: 'Raw body is required for signature verification.',
      });
      return;
    }

    const headers: Record<string, string | string[] | undefined> = {
      'x-timestamp': req.headers['x-timestamp'],
      'x-signature': req.headers['x-signature'],
    };

    const result = await this.webhooksService.processWebhook(rawBody, headers);

    if (!result.ok) {
      res.status(result.status).json({ error: result.message });
      return;
    }

    res
      .status(HttpStatus.OK)
      .json(result.duplicate ? { received: true, duplicate: true } : { received: true });
  }
}
