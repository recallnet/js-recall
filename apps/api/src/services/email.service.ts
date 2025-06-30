import axios from "axios";

import { config } from "@/config/index.js";

const EMAIL_VERIFICATION_PATH = "api/verify-email";

/**
 * Interface for verification email payload
 */
interface Payload {
  transactionalId: string;
  email: string;
  dataVariables: {
    verificationLink: string;
  };
}

/**
 * Email Service
 * Handles sending emails through the Loops API
 */
export class EmailService {
  private readonly apiKey: string;
  private readonly baseUrl: string =
    "https://app.loops.so/api/v1/transactional";
  private readonly apiDomain: string;
  private readonly transactionalId: string;

  /**
   * Creates a new instance of the EmailService
   */
  constructor() {
    this.apiKey = config.email.apiKey;
    this.apiDomain = config.api.domain.endsWith("/")
      ? config.api.domain
      : `${config.api.domain}/`;
    this.transactionalId = config.email.transactionalId;

    if (!this.apiKey) {
      console.warn(
        "[EmailService] No API key provided for email service. Email functionality will be disabled.",
      );
    }

    if (!this.transactionalId) {
      console.warn("[EmailService] No transactional id provided");
    }
  }

  /**
   * Sends a transactional email using a template
   * @param to The recipient email address
   * @param token The verification token to include in the link
   * @returns Promise resolving to the API response, or null if email functionality is disabled
   * @throws Error if the API request fails
   */
  async sendTransactionalEmail(
    to: string,
    token: string,
  ): Promise<unknown | null> {
    if (!this.isEmailEnabled()) {
      console.log(
        "[EmailService] Email sending skipped - API key or transactional ID not provided",
      );
      return null;
    }

    const verificationLink = this.formatVerificationLink(token);

    const payload: Payload = {
      email: to,
      transactionalId: this.transactionalId,
      dataVariables: {
        verificationLink: verificationLink,
      },
    };
    return this.sendEmail(payload);
  }

  /**
   * Sends an email using the Loops API
   * @param options Email options including recipients, subject, and content
   * @returns Promise resolving to the API response
   * @throws Error if the API request fails
   */
  private async sendEmail(payload: Payload): Promise<unknown> {
    try {
      const response = await axios.post(`${this.baseUrl}`, payload, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      console.log(`[EmailService] Email sent successfully`);
      return response.data;
    } catch (error) {
      console.error("[EmailService] Error sending email:", error);

      if (axios.isAxiosError(error)) {
        console.error("[EmailService] API response:", error.response?.data);
        throw new Error(
          `Failed to send email: ${error.response?.data?.message || error.message}`,
        );
      }

      throw new Error(`Failed to send email: ${error}`);
    }
  }

  /**
   * Checks if email functionality is enabled
   * @returns True if both API key and transactional ID are provided, false otherwise
   */
  private isEmailEnabled(): boolean {
    return Boolean(this.apiKey && this.transactionalId);
  }

  /**
   * Creates a verification link using the API domain from config
   * @param token The verification token to include in the link
   * @returns A properly formatted verification URL
   */
  private formatVerificationLink(token: string): string {
    return `${this.apiDomain}${EMAIL_VERIFICATION_PATH}?token=${token}`;
  }
}
