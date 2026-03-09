import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAppAccess } from '../../database/entities/user-app-access.entity';

export type OsWebhookEvent =
  | 'user.deactivated'
  | 'user.deleted'
  | 'user.reactivated';

export interface OsWebhookPayload {
  event: OsWebhookEvent;
  os_user_id: string;
  email: string;
  timestamp: string; // ISO 8601
}

@Injectable()
export class WebhookService {
  constructor(
    private config: ConfigService,
    @InjectRepository(UserAppAccess)
    private accessRepo: Repository<UserAppAccess>,
  ) {}

  /**
   * Notify all apps that have access records for this user.
   * Fires and forgets — failures are logged but never block the caller.
   */
  async notifyApps(
    osUserId: string,
    email: string,
    event: OsWebhookEvent,
  ): Promise<void> {
    // Load all access records for this user, with the application's webhook_url
    const records = await this.accessRepo.find({
      where: { user: { id: osUserId } },
      relations: ['application'],
    });

    const internalKey = this.config.get<string>('INTERNAL_API_KEY') ?? '';
    const payload: OsWebhookPayload = {
      event,
      os_user_id: osUserId,
      email,
      timestamp: new Date().toISOString(),
    };

    const promises = records
      .filter((r) => r.application?.webhook_url)
      .map(async (r) => {
        const url = r.application.webhook_url!;
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-key': internalKey,
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(5000), // 5 second timeout
          });
          if (!res.ok) {
            console.warn(
              `[WebhookService] ${r.application.slug} returned ${res.status} for event ${event} (user ${osUserId})`,
            );
          } else {
            console.log(
              `[WebhookService] ${r.application.slug} notified of ${event} for user ${osUserId}`,
            );
          }
        } catch (err) {
          // Never block — app may be down
          console.warn(
            `[WebhookService] Could not reach ${r.application.slug} at ${url} — ${err}`,
          );
        }
      });

    // Fire all notifications in parallel, wait for all to settle
    await Promise.allSettled(promises);
  }
}
