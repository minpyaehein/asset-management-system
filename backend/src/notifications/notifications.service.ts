import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";

import { Notification } from "./entities/notification.entity";

export type CreateNotificationInput = {
  userId: number;
  type: string;
  title: string;
  message: string;
  referenceType?: string | null;
  referenceId?: string | null;
};

export type RoleNotificationInput = {
  type: string;
  title: string;
  message: string;
  referenceType?: string | null;
  referenceId?: string | null;
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly repository: Repository<Notification>,

    private readonly dataSource: DataSource,
  ) {}

  create(input: CreateNotificationInput): Promise<Notification> {
    const notification = this.repository.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      isRead: false,
    });

    return this.repository.save(notification);
  }

  async notifyRoleUsers(
    roleId: number,
    input: RoleNotificationInput,
  ): Promise<Notification[]> {
    const users: Array<{ id: number }> =
      await this.dataSource.query(
        `
        SELECT "id"
        FROM "users"
        WHERE "role_id" = $1
          AND "status" = 'Active'
        `,
        [roleId],
      );

    if (users.length === 0) {
      return [];
    }

    const notifications = users.map((user) =>
      this.repository.create({
        userId: user.id,
        type: input.type,
        title: input.title,
        message: input.message,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        isRead: false,
      }),
    );

    return this.repository.save(notifications);
  }

  findForUser(userId: number): Promise<Notification[]> {
    return this.repository.find({
      where: { userId },
      order: {
        isRead: "ASC",
        createdAt: "DESC",
        id: "DESC",
      },
      take: 200,
    });
  }

  async markRead(
    id: number,
    userId: number,
  ): Promise<{ success: true }> {
    const notification = await this.repository.findOne({
      where: {
        id,
        userId,
      },
    });

    if (!notification) {
      throw new NotFoundException("Notification not found.");
    }

    notification.isRead = true;
    await this.repository.save(notification);

    return {
      success: true,
    };
  }

  async markAllRead(
    userId: number,
  ): Promise<{
    success: true;
    updated: number;
  }> {
    const result = await this.repository.update(
      {
        userId,
        isRead: false,
      },
      {
        isRead: true,
      },
    );

    return {
      success: true,
      updated: result.affected ?? 0,
    };
  }
}