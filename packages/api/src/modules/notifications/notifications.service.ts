import { Injectable, Logger } from '@nestjs/common';
import { SupabaseProvider } from '../../providers/supabase.provider';
import { Resend } from 'resend';

type NotificationType = 'ticket_escalated' | 'action_pending' | 'report_ready' | 'lead_new' | 'task_due';

interface NotificationPayload {
  businessId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly resend: Resend;

  constructor(private readonly supabase: SupabaseProvider) {
    this.resend = new Resend(process.env['RESEND_API_KEY']);
  }

  async send(notification: NotificationPayload): Promise<void> {
    try {
      const { data: business } = await this.supabase.getAdminClient()
        .from('businesses')
        .select('name, user_id')
        .eq('id', notification.businessId)
        .single();

      if (!business) return;

      const { data: user } = await this.supabase.getAdminClient()
        .from('users')
        .select('email, full_name')
        .eq('id', business.user_id)
        .single();

      if (!user?.email) return;

      await this.supabase.getAdminClient()
        .from('notifications')
        .insert({
          business_id: notification.businessId,
          user_id: business.user_id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          metadata: notification.metadata ?? {},
          read: false,
        });

      if (this.shouldEmailNotify(notification.type)) {
        await this.sendEmail(user.email, user.full_name ?? 'there', business.name, notification);
      }
    } catch (err) {
      this.logger.error('Notification send failed', { err, notification });
    }
  }

  async listNotifications(businessId: string, userId: string, unreadOnly = false) {
    let query = this.supabase.getAdminClient()
      .from('notifications')
      .select('*')
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (unreadOnly) query = query.eq('read', false);

    const { data } = await query;
    return data ?? [];
  }

  async markRead(notificationId: string, userId: string): Promise<void> {
    await this.supabase.getAdminClient()
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', userId);
  }

  async markAllRead(businessId: string, userId: string): Promise<void> {
    await this.supabase.getAdminClient()
      .from('notifications')
      .update({ read: true })
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .eq('read', false);
  }

  async getUnreadCount(businessId: string, userId: string): Promise<number> {
    const { count } = await this.supabase.getAdminClient()
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .eq('read', false);
    return count ?? 0;
  }

  private shouldEmailNotify(type: NotificationType): boolean {
    return ['ticket_escalated', 'action_pending'].includes(type);
  }

  private async sendEmail(
    email: string,
    name: string,
    businessName: string,
    notification: NotificationPayload,
  ): Promise<void> {
    try {
      await this.resend.emails.send({
        from: 'AI BizOS <alerts@ai-biz-os.com>',
        to: email,
        subject: `[${businessName}] ${notification.title}`,
        html: `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
            <h2 style="color:#0f172a">${notification.title}</h2>
            <p style="color:#374151">Hi ${name},</p>
            <p style="color:#374151">${notification.body}</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
            <p style="font-size:12px;color:#6b7280">AI BizOS — ${businessName}</p>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error('Email notification failed', { err, email });
    }
  }
}
