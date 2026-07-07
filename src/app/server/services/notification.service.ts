import { prisma } from "@/app/lib/prisma";
import { Roles } from "@prisma/client";
import { broadcast,SystemEvent } from "@/app/lib/sseEvent/sse";


export interface NotificationTarget {
  userIds?: string[];
  roles?: Roles[];
  supervisorOfUserId?: string; // Finds and targets the supervisor of this user
  excludeUserId?: string;      // Exclude the user who triggered the event
}

export interface SendNotificationParams {
  companyId: string;
  message: string;
  type?: string;
  referenceId?: string;
  target: NotificationTarget;
}

/**
 * Resolves notification targets and inserts notification logs in bulk
 */
export async function sendNotification({
  companyId,
  message,
  type,
  referenceId,
  target,
}: SendNotificationParams) {
  try {
    const recipientIds = new Set<string>();

    // 1. Direct User IDs
    if (target.userIds && target.userIds.length > 0) {
      target.userIds.forEach((id) => recipientIds.add(id));
    }

    // 2. Supervisor of a specific user
    if (target.supervisorOfUserId) {
      const user = await prisma.user.findUnique({
        where: { id: target.supervisorOfUserId },
        select: { supervisor_id: true },
      });
      if (user?.supervisor_id) {
        recipientIds.add(user.supervisor_id);
      }
    }

    // 3. Roles in the company
    if (target.roles && target.roles.length > 0) {
      const usersWithRoles = await prisma.user.findMany({
        where: {
          company_id: companyId,
          role: { in: target.roles },
          restricted: false,
        },
        select: { id: true },
      });
      usersWithRoles.forEach((u) => recipientIds.add(u.id));
    }

    // 4. Exclude trigger user if specified
    if (target.excludeUserId) {
      recipientIds.delete(target.excludeUserId);
    }

    if (recipientIds.size === 0) {
      console.log("[Notification Service] No recipients resolved for notification.");
      return [];
    }

    // 5. Create notifications in bulk (Optimized database write)
    const notificationData = Array.from(recipientIds).map((userId) => ({
      company_id: companyId,
      user_id: userId,
      message,
      type: type || null,
      reference_id: referenceId || null,
      is_read: false,
    }));

    await prisma.notification.createMany({
      data: notificationData,
    });

    let sseType: SystemEvent = "NOTIFICATION_CREATED";
    if (type === "TOPUP_CREATED" || type === "SALE_CREATED" || type === "SHORTAGE_CREATED" || type === "FLOAT_UPDATED") {
      sseType = type;
    } else if (type === "SALE_VERIFIED" || type === "SALE_REJECTED") {
      sseType = "SALE_CREATED";
    } else if (
      type === "REMITTANCE_SUBMISSION" ||
      type === "REMITTANCE_ACCEPTED" ||
      type === "REMITTANCE_REJECTED" ||
      type === "REMITTANCE_CANCELLED" ||
      type === "REMITTANCE_REVERSED" ||
      type === "REMITTANCE_CREATED"
    ) {
      sseType = "REMITTANCE_CREATED";
    } else if (type === "FINE_ISSUED" || type === "FINE_CREATED") {
      sseType = "FINE_CREATED";
    }

    broadcast(sseType, {
      message,
      type: type || null,
      referenceId: referenceId || null,
    }, {
      userIds: Array.from(recipientIds)
    });

    console.log(`[Notification Service] Successfully sent notification to ${recipientIds.size} users.`);
    return Array.from(recipientIds);
  } catch (error) {
    console.error("[Notification Service] Error sending notification:", error);
    throw error;
  }
}
