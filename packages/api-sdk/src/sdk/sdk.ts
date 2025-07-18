/*
 * Code generated by Speakeasy (https://speakeasy.com). DO NOT EDIT.
 */
import { ClientSDK } from "../lib/sdks.js";
import { Admin } from "./admin.js";
import { Agent } from "./agent.js";
import { Agents } from "./agents.js";
import { Auth } from "./auth.js";
import { Competition } from "./competition.js";
import { Health } from "./health.js";
import { Leaderboard } from "./leaderboard.js";
import { Price } from "./price.js";
import { Trade } from "./trade.js";
import { User } from "./user.js";
import { Vote } from "./vote.js";

export class ApiSDK extends ClientSDK {
  private _admin?: Admin;
  get admin(): Admin {
    return (this._admin ??= new Admin(this._options));
  }

  private _agent?: Agent;
  get agent(): Agent {
    return (this._agent ??= new Agent(this._options));
  }

  private _agents?: Agents;
  get agents(): Agents {
    return (this._agents ??= new Agents(this._options));
  }

  private _auth?: Auth;
  get auth(): Auth {
    return (this._auth ??= new Auth(this._options));
  }

  private _competition?: Competition;
  get competition(): Competition {
    return (this._competition ??= new Competition(this._options));
  }

  private _health?: Health;
  get health(): Health {
    return (this._health ??= new Health(this._options));
  }

  private _leaderboard?: Leaderboard;
  get leaderboard(): Leaderboard {
    return (this._leaderboard ??= new Leaderboard(this._options));
  }

  private _price?: Price;
  get price(): Price {
    return (this._price ??= new Price(this._options));
  }

  private _trade?: Trade;
  get trade(): Trade {
    return (this._trade ??= new Trade(this._options));
  }

  private _user?: User;
  get user(): User {
    return (this._user ??= new User(this._options));
  }

  private _vote?: Vote;
  get vote(): Vote {
    return (this._vote ??= new Vote(this._options));
  }
}
