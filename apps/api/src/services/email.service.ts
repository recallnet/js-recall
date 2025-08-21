import { config } from "@/config/index.js";
import { serviceLogger } from "@/lib/logger.js";

interface LoopsPayload {
  email: string;
  subscribed: boolean;
  mailingLists: {
    [key: string]: boolean;
  };
}

/**
 * Email Service
 * Handles sending emails through the Loops API (e.g, marketing emails)
 */
export class EmailService {
  private readonly apiKey: string;
  private readonly mailingListId: string;
  private readonly baseUrl = "https://app.loops.so/api/v1";

  constructor() {
    this.apiKey = config.email.apiKey;
    this.mailingListId = config.email.mailingListId;

    if (!this.apiKey) {
      serviceLogger.error("[EmailService] LOOPS_API_KEY not configured");
    }

    if (!this.mailingListId) {
      serviceLogger.error(
        "[EmailService] LOOPS_MAILING_LIST_ID not configured",
      );
    }
  }

  /**
   * Subscribe a user to the mailing list
   * First tries to create, if user exists, then updates
   * @param email User's email address
   * @param options Additional user data
   */
  async subscribeOrUnsubscribeUser(
    email: string,
    subscribed: boolean,
  ): Promise<{ success: boolean; error?: string } | null> {
    if (!this.isConfigured()) {
      serviceLogger.info(
        "[EmailService] Loops configuration missing - API key or mailing list ID not provided",
      );
      return null;
    }

    try {
      // Prepare the payload for Loops API
      const payload: LoopsPayload = {
        email,
        subscribed,
        mailingLists: {
          [this.mailingListId]: true,
        },
      };

      // Try to create the contact first
      const createResult = await this.createContact(payload);
      if (createResult.success) {
        serviceLogger.info(
          `[EmailService] Successfully created contact for ${email}`,
        );
        return createResult;
      }

      // If creation failed, try to update (user might already exist)
      if (
        createResult.error?.includes("already exists") ||
        createResult.error?.includes("duplicate")
      ) {
        serviceLogger.debug(`[EmailService] Contact exists, updating ${email}`);
        return await this.updateContact(payload);
      }

      // If it's another error, return it
      return createResult;
    } catch (error) {
      serviceLogger.error(
        `[EmailService] Error subscribing user ${email}:`,
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Create a new contact in Loops
   */
  private async createContact(
    payload: LoopsPayload,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/contacts/create`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true };
      } else {
        serviceLogger.error("[EmailService] Create contact failed:", data);
        return {
          success: false,
          error: data.message || `HTTP ${response.status}`,
        };
      }
    } catch (error) {
      serviceLogger.error("[EmailService] Error creating contact:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  }

  /**
   * Update an existing contact in Loops
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

      const data = await response.json();

      if (response.ok) {
        return { success: true };
      } else {
        serviceLogger.error("[EmailService] Update contact failed:", data);
        return {
          success: false,
          error: data.message || `HTTP ${response.status}`,
        };
      }
    } catch (error) {
      serviceLogger.error("[EmailService] Error updating contact:", error);
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
    return !!(this.apiKey && this.mailingListId);
  }
}
