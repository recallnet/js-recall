import { v4 as uuidv4 } from "uuid";

import {
  create,
  getUnprocessed,
  markAsProcessed,
  markAsProcessingFailed,
} from "@/database/repositories/events-queue-repository.js";
import type {
  EventData,
  SelectEventQueue,
} from "@/database/repositories/events-queue-repository.js";

export const EVENTS = {
  USER_SIGNED_UP: "user_signed_up",
  USER_LOGGED_IN: "user_logged_in",
  USER_PROFILE_VIEWED: "user_profile_viewed",
  USER_PROFILE_UPDATED: "user_profile_updated",
  USER_SUBMITTED_VOTE: "user_submitted_vote",
  USER_LISTED_AGENTS: "user_listed_agents",
  USER_VIEWED_VOTE_HISTORY_PAGE: "user_viewed_vote_history_page",

  AGENT_REGISTERED: "agent_registered",
  AGENT_PROFILE_VIEWED: "agent_profile_viewed",
  AGENT_PUBLIC_PROFILE_VIEWED: "agent_public_profile_viewed",
  AGENT_JOINED_COMPETITION: "agent_joined_competition",
  AGENT_VOTED_ON: "agent_voted_on",

  COMPETITIONS_LISTED: "competitions_listed",
  COMPETITION_LEADERBOARD_PAGE_VIEWED: "competition_leaderboard_page_viewed",
  COMPETITION_DETAILS_VIEWED: "competition_details_viewed",
} as const;

export type EventType = keyof typeof EVENTS;

/**
 * EventData Builder for creating CloudEvents-compliant events with sensible defaults
 */
export class EventDataBuilder {
  private event: Partial<EventData> = {};

  constructor() {
    // Set default values
    this.event.spec_version = "1.0.2";
    this.event.id = uuidv4();
    this.event.time = new Date().toISOString();
    this.event.data_content_type = "application/json";

    // bump minor when you change the value you send to a field
    // bump major when you add a new field
    this.event.data_version = "1.0";
    this.event.data = {};
  }

  /**
   * Set the event type (required)
   */
  type(type: string): EventDataBuilder {
    this.event.type = type;
    return this;
  }

  /**
   * Set the event source (required)
   */
  source(source: string): EventDataBuilder {
    this.event.source = source;
    return this;
  }

  /**
   * Override the default spec version
   */
  specVersion(version: string): EventDataBuilder {
    this.event.spec_version = version;
    return this;
  }

  /**
   * Override the default event ID
   */
  id(id: string): EventDataBuilder {
    this.event.id = id;
    return this;
  }

  /**
   * Override the default timestamp
   */
  time(time: string | Date): EventDataBuilder {
    this.event.time = time instanceof Date ? time.toISOString() : time;
    return this;
  }

  /**
   * Override the default data content type
   */
  dataContentType(contentType: string): EventDataBuilder {
    this.event.data_content_type = contentType;
    return this;
  }

  /**
   * Override the default data version
   */
  dataVersion(version: string): EventDataBuilder {
    this.event.data_version = version;
    return this;
  }

  /**
   * Add additional custom fields
   */
  addField(key: string, value: unknown): EventDataBuilder {
    this.event.data![key] = value;
    return this;
  }

  /**
   * Add multiple custom fields
   */
  addFields(fields: Record<string, unknown>): EventDataBuilder {
    for (const [key, value] of Object.entries(fields)) {
      this.event.data![key] = value;
    }
    return this;
  }

  /**
   * Build the final EventData object
   * Validates that required fields are present
   */
  build(): EventData {
    if (!this.event.type) {
      throw new Error("Event type is required");
    }
    if (!this.event.source) {
      throw new Error("Event source is required");
    }

    return this.event as EventData;
  }
}

/**
 * Event Tracker Service
 * Handles tracking of user and system events following CloudEvents specification
 */
export class EventTracker {
  /**
   * Track an event
   */
  async track(eventData: EventData): Promise<void> {
    try {
      await create(eventData);

      console.log(`[EventTracker] Tracked event: ${eventData.type}`);
    } catch (error) {
      console.error(
        `[EventTracker] Failed to track event ${eventData.type}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get unprocessed events for background job
   */
  async getUnprocessedEvents(limit: number = 100): Promise<SelectEventQueue[]> {
    return await getUnprocessed(limit);
  }

  /**
   * Mark events as processed
   */
  async markAsProcessed(eventIds: string[]): Promise<void> {
    await markAsProcessed(eventIds);
  }

  /**
   * Mark event as failed processing
   */
  async markAsProcessingFailed(eventId: string, error: string): Promise<void> {
    await markAsProcessingFailed(eventId, error);
  }
}

// Export the EventData type for use in other files
export type { EventData };
