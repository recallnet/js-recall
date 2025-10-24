import { Logger } from "pino";

/**
 * Metadata for where the user came from (stored in the Loops mailing list)
 */
const LOOPS_SOURCE = "comps_app";

/**
 * Response from the Loops API
 */
export interface LoopsResponse {
  success: boolean;
  id?: string;
  message?: string;
}

/**
 * Loops API payload for updating a contact
 * Note: the `email` field is the only required field in the payload.
 */
export interface LoopsPayload {
  email: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  source?: string;
  subscribed?: boolean;
  mailingLists?: {
    [key: string]: boolean;
  };
}

export interface EmailServiceConfig {
  email: {
    apiKey: string;
    mailingListId: string;
    baseUrl: string;
  };
}

/**
 * Email Service
 * Handles sending emails through the Loops API (e.g, marketing emails)
 */
export class EmailService {
  private readonly apiKey: string;
  private readonly mailingListId: string;
  private readonly baseUrl: string;
  private readonly logger: Logger;

  constructor(config: EmailServiceConfig, logger: Logger) {
    this.apiKey = config.email.apiKey;
    this.mailingListId = config.email.mailingListId;
    this.baseUrl = config.email.baseUrl;
    this.logger = logger;

    if (!this.apiKey) {
      this.logger.warn("[EmailService] LOOPS_API_KEY not configured");
    }
    if (!this.mailingListId) {
      this.logger.warn("[EmailService] LOOPS_MAILING_LIST_ID not configured");
    }
    if (!this.baseUrl) {
      this.logger.warn("[EmailService] LOOPS_BASE_URL not configured");
    }
  }

  /**
   * Subscribe a user to the mailing list. First tries to create, unless user exists, then updates
   * @param email User's email address
   * @param options Optional user metadata to update (`userId` or `name`), often used for new users
   */
  async subscribeUser(
    email: string,
    options?: {
      userId?: string;
      name?: string;
    },
  ): Promise<{ success: boolean; error?: string } | null> {
    if (!this.isConfigured()) {
      this.logger.warn(
        "[EmailService] Loops configuration missing - API key or mailing list ID not provided",
      );
      return null;
    }
    this.logger.debug(
      `[EmailService] Subscribing user ${email} to mailing list ${this.mailingListId}`,
    );

    try {
      const payload: LoopsPayload = {
        userId: options?.userId,
        email,
        firstName: options?.name,
        source: LOOPS_SOURCE,
        subscribed: true,
        mailingLists: {
          [this.mailingListId]: true,
        },
      };

      return await this.updateContact(payload);
    } catch (error) {
      this.logger.error(
        `[EmailService] Error subscribing user ${email}:`,
        error,
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown email subscription error",
      };
    }
  }

  /**
   * Unsubscribe a user from the mailing list
   * @param email User's email address
   * @param options Optional user metadata to update (`userId` or `name`)
   */
  async unsubscribeUser(
    email: string,
  ): Promise<{ success: boolean; error?: string } | null> {
    if (!this.isConfigured()) {
      this.logger.warn(
        "[EmailService] Loops configuration missing - API key or mailing list ID not provided",
      );
      return null;
    }
    this.logger.debug(
      `[EmailService] Unsubscribing user from mailing list: ${email}`,
    );

    try {
      // Prepare the payload for Loops API
      const payload: LoopsPayload = {
        email,
        source: LOOPS_SOURCE,
        subscribed: false,
        mailingLists: {
          [this.mailingListId]: false,
        },
      };

      return await this.updateContact(payload);
    } catch (error) {
      this.logger.error(
        `[EmailService] Error unsubscribing user ${email}:`,
        error,
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown email subscription error",
      };
    }
  }

  /**
   * Update an existing contact in Loops. If the contact doesn't exist, Loops will automatically
   * create a new contact.
   * @param payload The payload to update the contact with
   * @returns The response from the Loops API
   */
  private async updateContact(
    payload: LoopsPayload,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/contacts/update`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data: LoopsResponse = await response.json();

      if (!data.success) {
        this.logger.error("[EmailService] Update contact failed:", data);
        throw new Error(data.message || `Loops API error: ${response.status}`);
      }
      return { success: true };
    } catch (error) {
      this.logger.error({ error }, "[EmailService] Error updating contact");
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  }

  /**
   * Check if Loops is properly configured (e.g., we ignore unless configured)
   */
  isConfigured(): boolean {
    return !!(this.apiKey && this.mailingListId && this.baseUrl);
  }
}
