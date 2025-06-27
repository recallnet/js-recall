import { NextFunction, Request, Response } from "express";
import * as qs from "qs";

export const queryParserMiddleware = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.url.includes("?")) {
      const queryString = req.url.split("?")[1];
      if (queryString) {
        req.query = qs.parse(queryString, { allowDots: true });
      }
    }
    next();
  };
};
