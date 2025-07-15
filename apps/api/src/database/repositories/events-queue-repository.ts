import { eq, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { db } from "@/database/db.js";
import { eventsQueue } from "@/database/schema/core/defs.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";

/**
 * Event data structure following CloudEvents specification
 */
export interface EventData {
  spec_version: string;
  type: string;
  source: string;
  id: string;
  time: string;
  data_content_type: string;
  data_version: string;
  data: Record<string, unknown>;
}

/**
 * Insert type for events queue
 */
export interface InsertEventQueue {
  id: string;
  event: EventData;
  processed: boolean;
  processedAt?: Date;
  processingError?: string;
  createdAt: Date;
}

/**
 * Select type for events queue
 */
export interface SelectEventQueue {
  id: string;
  event: EventData;
  processed: boolean;
  processedAt: Date | null;
  processingError: string | null;
  createdAt: Date;
}

/**
 * Events Queue Repository
 * Handles database operations for events queue
 */

/**
 * Create a new event in the queue
 * @param eventData The CloudEvents-compliant event data
 */
async function createImpl(eventData: EventData): Promise<SelectEventQueue> {
  try {
    const now = new Date();
    const data: InsertEventQueue = {
      id: uuidv4(),
      event: eventData,
      processed: false,
      createdAt: now,
    };

    const [result] = await db.insert(eventsQueue).values(data).returning();

    if (!result) {
      throw new Error("Failed to create event - no result returned");
    }

    return {
      ...result,
      event: result.event as EventData,
    };
  } catch (error) {
    console.error("[EventsQueueRepository] Error in create:", error);
    throw error;
  }
}

/**
 * Get unprocessed events for background job processing
 * @param limit Maximum number of events to retrieve
 */
async function getUnprocessedImpl(
  limit: number = 100,
): Promise<SelectEventQueue[]> {
  try {
    const results = await db
      .select()
      .from(eventsQueue)
      .where(eq(eventsQueue.processed, false))
      .orderBy(eventsQueue.createdAt)
      .limit(limit);

    return results.map((result) => ({
      ...result,
      event: result.event as EventData,
    }));
  } catch (error) {
    console.error("[EventsQueueRepository] Error in getUnprocessed:", error);
    throw error;
  }
}

/**
 * Mark events as processed
 * @param eventIds Array of event IDs to mark as processed
 */
async function markAsProcessedImpl(eventIds: string[]): Promise<void> {
  try {
    if (eventIds.length === 0) {
      return;
    }

    await db
      .update(eventsQueue)
      .set({
        processed: true,
        processedAt: new Date(),
      })
      .where(inArray(eventsQueue.id, eventIds));
  } catch (error) {
    console.error("[EventsQueueRepository] Error in markAsProcessed:", error);
    throw error;
  }
}

/**
 * Mark event as failed processing
 * @param eventId The event ID to mark as failed
 * @param error The error message to store
 */
async function markAsProcessingFailedImpl(
  eventId: string,
  error: string,
): Promise<void> {
  try {
    await db
      .update(eventsQueue)
      .set({
        processingError: error,
      })
      .where(eq(eventsQueue.id, eventId));
  } catch (error) {
    console.error(
      "[EventsQueueRepository] Error in markAsProcessingFailed:",
      error,
    );
    throw error;
  }
}

/**
 * Find an event by ID
 * @param id Event ID to find
 */
async function findByIdImpl(id: string): Promise<SelectEventQueue | undefined> {
  try {
    const [result] = await db
      .select()
      .from(eventsQueue)
      .where(eq(eventsQueue.id, id));

    if (!result) {
      return undefined;
    }

    return {
      ...result,
      event: result.event as EventData,
    };
  } catch (error) {
    console.error("[EventsQueueRepository] Error in findById:", error);
    throw error;
  }
}

// =============================================================================
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// =============================================================================

/**
 * All repository functions wrapped with timing and metrics
 * These are the functions that should be imported by services
 */

export const create = createTimedRepositoryFunction(
  createImpl,
  "EventsQueueRepository",
  "create",
);

export const getUnprocessed = createTimedRepositoryFunction(
  getUnprocessedImpl,
  "EventsQueueRepository",
  "getUnprocessed",
);

export const markAsProcessed = createTimedRepositoryFunction(
  markAsProcessedImpl,
  "EventsQueueRepository",
  "markAsProcessed",
);

export const markAsProcessingFailed = createTimedRepositoryFunction(
  markAsProcessingFailedImpl,
  "EventsQueueRepository",
  "markAsProcessingFailed",
);

export const findById = createTimedRepositoryFunction(
  findByIdImpl,
  "EventsQueueRepository",
  "findById",
);
