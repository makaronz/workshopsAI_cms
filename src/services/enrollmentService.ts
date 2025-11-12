import { db } from "../config/database";
import {
  enrollments,
  workshops,
  users,
} from "../models/schema";
import { eq, and, desc, asc, gte, lte, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import type {
  CreateEnrollmentInput,
  UpdateEnrollmentInput,
  EnrollmentFilter,
} from "../types/validation";

export class EnrollmentService {
  // Create enrollment
  static async createEnrollment(userId: number, data: CreateEnrollmentInput) {
    // Check if workshop exists and is published
    const workshop = await db.query.workshops.findFirst({
      where: eq(workshops.id, data.workshopId),
    });

    if (!workshop) {
      throw new Error("Workshop not found");
    }

    if (workshop.status !== "published") {
      throw new Error("Workshop is not available for enrollment");
    }

    // Check if user is already enrolled
    const existingEnrollment = await db.query.enrollments.findFirst({
      where: and(
        eq(enrollments.workshopId, data.workshopId),
        eq(enrollments.participantId, userId)
      ),
    });

    if (existingEnrollment) {
      throw new Error("User is already enrolled in this workshop");
    }

    // Check workshop capacity
    const [currentEnrollments] = await db
      .select({ count: { count: enrollments.participantId } })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.workshopId, data.workshopId),
          inArray(enrollments.status, ["confirmed", "pending"])
        )
      );

    const enrolledCount = currentEnrollments.count.count;
    const seatLimit = workshop.seatLimit;

    if (seatLimit && enrolledCount >= seatLimit) {
      if (!workshop.enableWaitingList) {
        throw new Error("Workshop is full and waiting list is disabled");
      }
      // Add to waiting list
      const [enrollment] = await db
        .insert(enrollments)
        .values({
          id: uuidv4(),
          workshopId: data.workshopId,
          participantId: userId,
          status: "waitlisted",
          notes: data.notes,
          specialRequirements: data.specialRequirements,
          enrollmentDate: new Date(),
        })
        .returning();

      return enrollment;
    }

    // Create enrollment
    const [enrollment] = await db
      .insert(enrollments)
      .values({
        id: uuidv4(),
        workshopId: data.workshopId,
        participantId: userId,
        status: "pending",
        notes: data.notes,
        specialRequirements: data.specialRequirements,
        enrollmentDate: new Date(),
      })
      .returning();

    return enrollment;
  }

  // Update enrollment
  static async updateEnrollment(id: string, userId: number, data: UpdateEnrollmentInput) {
    const enrollment = await this.getEnrollmentById(id);

    if (!enrollment) {
      throw new Error("Enrollment not found");
    }

    // Check permissions
    const isParticipant = enrollment.participantId === userId;
    const isFacilitator = await this.checkIfUserIsFacilitator(enrollment.workshopId, userId);
    const isAdmin = false; // Will be checked by middleware

    if (!isParticipant && !isFacilitator && !isAdmin) {
      throw new Error("Permission denied");
    }

    // Update attendance tracking - only facilitators or admins can update attendance
    let updateData = { ...data };
    if (data.attendance && !isFacilitator && !isAdmin) {
      delete updateData.attendance;
    }

    const [updatedEnrollment] = await db
      .update(enrollments)
      .set({
        ...updateData,
        paymentAmount: data.paymentAmount?.toString(),
        confirmedAt: data.status === "confirmed" ? new Date() : undefined,
        cancelledAt: data.status === "cancelled" ? new Date() : undefined,
        completedAt: data.status === "completed" ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(enrollments.id, id))
      .returning();

    return updatedEnrollment;
  }

  // Get enrollment by ID
  static async getEnrollmentById(id: string) {
    const enrollment = await db.query.enrollments.findFirst({
      where: eq(enrollments.id, id),
      with: {
        workshop: {
          with: {
            creator: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        },
        participant: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return enrollment;
  }

  // List enrollments with filtering and pagination
  static async listEnrollments(filter: EnrollmentFilter, requestingUserId?: number, userRole?: string) {
    const {
      page,
      limit,
      sortBy = "enrollmentDate",
      sortOrder = "desc",
      status,
      workshopId,
      paymentStatus,
      startDateFrom,
      startDateTo,
    } = filter;

    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [];

    // Participants can only see their own enrollments
    if (userRole === "participant" && requestingUserId) {
      conditions.push(eq(enrollments.participantId, requestingUserId));
    }

    if (status) {
      conditions.push(eq(enrollments.status, status));
    }

    if (workshopId) {
      conditions.push(eq(enrollments.workshopId, workshopId));
    }

    if (paymentStatus) {
      conditions.push(eq(enrollments.paymentStatus, paymentStatus));
    }

    if (startDateFrom) {
      conditions.push(gte(enrollments.enrollmentDate, new Date(startDateFrom)));
    }

    if (startDateTo) {
      conditions.push(lte(enrollments.enrollmentDate, new Date(startDateTo)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Build order clause
    const orderClause = sortOrder === "asc" ? asc(enrollments[sortBy]) : desc(enrollments[sortBy]);

    // Get total count
    const [totalCountResult] = await db
      .select({ count: { count: enrollments.id } })
      .from(enrollments)
      .where(whereClause);

    const total = totalCountResult.count.count;

    // Get enrollments
    const enrollmentList = await db.query.enrollments.findMany({
      where: whereClause,
      orderBy: [orderClause],
      limit,
      offset,
      with: {
        workshop: {
          columns: {
            id: true,
            title: true,
            slug: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        },
        participant: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      enrollments: enrollmentList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Confirm enrollment
  static async confirmEnrollment(id: string, userId: number) {
    const enrollment = await this.getEnrollmentById(id);

    if (!enrollment) {
      throw new Error("Enrollment not found");
    }

    // Check if user is facilitator or admin
    const isFacilitator = await this.checkIfUserIsFacilitator(enrollment.workshopId, userId);
    if (!isFacilitator) {
      throw new Error("Permission denied");
    }

    if (enrollment.status !== "pending" && enrollment.status !== "waitlisted") {
      throw new Error("Enrollment cannot be confirmed");
    }

    const [confirmedEnrollment] = await db
      .update(enrollments)
      .set({
        status: "confirmed",
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(enrollments.id, id))
      .returning();

    return confirmedEnrollment;
  }

  // Cancel enrollment
  static async cancelEnrollment(id: string, userId: number, reason?: string) {
    const enrollment = await this.getEnrollmentById(id);

    if (!enrollment) {
      throw new Error("Enrollment not found");
    }

    // Check if user is participant, facilitator, or admin
    const isParticipant = enrollment.participantId === userId;
    const isFacilitator = await this.checkIfUserIsFacilitator(enrollment.workshopId, userId);

    if (!isParticipant && !isFacilitator) {
      throw new Error("Permission denied");
    }

    if (enrollment.status === "cancelled" || enrollment.status === "completed") {
      throw new Error("Enrollment cannot be cancelled");
    }

    const updateData: any = {
      status: "cancelled",
      cancelledAt: new Date(),
      updatedAt: new Date(),
    };

    if (reason && isParticipant) {
      updateData.notes = reason;
    }

    const [cancelledEnrollment] = await db
      .update(enrollments)
      .set(updateData)
      .where(eq(enrollments.id, id))
      .returning();

    return cancelledEnrollment;
  }

  // Mark attendance
  static async markAttendance(id: string, sessionId: string, userId: number, attended: boolean, notes?: string) {
    const enrollment = await this.getEnrollmentById(id);

    if (!enrollment) {
      throw new Error("Enrollment not found");
    }

    // Check if user is facilitator
    const isFacilitator = await this.checkIfUserIsFacilitator(enrollment.workshopId, userId);
    if (!isFacilitator) {
      throw new Error("Permission denied");
    }

    if (enrollment.status !== "confirmed") {
      throw new Error("Can only mark attendance for confirmed enrollments");
    }

    // Get current attendance
    const currentAttendance = (enrollment.attendance as any[]) || [];

    // Update or add attendance record
    const attendanceIndex = currentAttendance.findIndex((a: any) => a.sessionId === sessionId);

    if (attendanceIndex >= 0) {
      currentAttendance[attendanceIndex] = {
        sessionId,
        attended,
        notes: notes || currentAttendance[attendanceIndex].notes,
        updatedAt: new Date(),
      };
    } else {
      currentAttendance.push({
        sessionId,
        attended,
        notes,
        updatedAt: new Date(),
      });
    }

    const [updatedEnrollment] = await db
      .update(enrollments)
      .set({
        attendance: currentAttendance,
        updatedAt: new Date(),
      })
      .where(eq(enrollments.id, id))
      .returning();

    return updatedEnrollment;
  }

  // Get workshop enrollment statistics
  static async getWorkshopEnrollmentStats(workshopId: string) {
    const stats = await db
      .select({
        status: enrollments.status,
        count: { count: enrollments.id },
      })
      .from(enrollments)
      .where(eq(enrollments.workshopId, workshopId))
      .groupBy(enrollments.status);

    const result = {
      total: 0,
      pending: 0,
      confirmed: 0,
      waitlisted: 0,
      cancelled: 0,
      completed: 0,
    };

    stats.forEach((stat) => {
      result.total += stat.count.count;
      result[stat.status] = stat.count.count;
    });

    return result;
  }

  // Get participant enrollment history
  static async getParticipantEnrollmentHistory(userId: number, limit = 20) {
    const enrollments = await db.query.enrollments.findMany({
      where: eq(enrollments.participantId, userId),
      orderBy: [desc(enrollments.enrollmentDate)],
      limit,
      with: {
        workshop: {
          columns: {
            id: true,
            title: true,
            slug: true,
            startDate: true,
            endDate: true,
            status: true,
            imageUrl: true,
          },
        },
      },
    });

    return enrollments;
  }

  // Helper method to check if user is facilitator of a workshop
  private static async checkIfUserIsFacilitator(workshopId: string, userId: number): Promise<boolean> {
    // This would need to be implemented based on your facilitator relationship
    // For now, returning false (would be implemented when we have facilitator-workshop relations)
    return false;
  }
}