/**
 * User state atom for tracking login status and wallet address
 *
 * This atom manages the user's authentication state throughout the application
 */
import { atom } from "jotai";

/**
 * User state interface
 */
export interface UserState {
  /**
   * Whether the user is logged in
   */
  loggedIn: boolean;

  /**
   * User's wallet address
   */
  address: string;
}

/**
 * Global atom for user state
 */
export const userAtom = atom<UserState>({
  loggedIn: false,
  address: "",
});
