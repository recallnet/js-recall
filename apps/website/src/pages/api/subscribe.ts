// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";

import {
  FORM_ENDPOINT,
  FORM_LIST_ID_COMPS,
  FORM_LIST_ID_GENERAL,
  FORM_SOURCE,
} from "@/constants";

type ResponseData = {
  success: boolean;
  message?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>,
) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  const { email, listType } = req.body;

  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "Email is required" });
  }

  if (!listType) {
    return res
      .status(400)
      .json({ success: false, message: "List type is required" });
  }

  const formListIds =
    listType === "general"
      ? FORM_LIST_ID_GENERAL
      : `${FORM_LIST_ID_COMPS},${FORM_LIST_ID_GENERAL}`;

  try {
    const formBody = `email=${encodeURIComponent(email)}&source=${encodeURIComponent(FORM_SOURCE)}&mailingLists=${encodeURIComponent(formListIds)}`;

    const response = await fetch(FORM_ENDPOINT, {
      method: "POST",
      body: formBody,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      throw new Error("Newsletter subscription failed");
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Newsletter subscription error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to subscribe to newsletter",
    });
  }
}
