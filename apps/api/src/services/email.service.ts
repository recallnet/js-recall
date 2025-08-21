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
   * @param subscribe Whether to subscribe the user (true) or unsubscribe (false)
   */
  async subscribeOrUnsubscribeUser(
    email: string,
    subscribe: boolean,
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
        subscribed: subscribe,
        mailingLists: {
          [this.mailingListId]: true,
        },
      };

      return await this.updateContact(payload);
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
   * Update an existing contact in Loops. If the contact doesn't exist, Loops will automatically
   * create it.
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
