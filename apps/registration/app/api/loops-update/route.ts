import { NextRequest, NextResponse } from "next/server";

interface LoopsUpdateBody {
  email: string;
  name: string;
}

/**
 * POST handler for updating user information in Loops
 *
 * @param request Next.js request object
 * @returns JSON response with update result
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = (await request.json()) as LoopsUpdateBody;

    // Validate required fields
    if (!body.email || !body.name) {
      return NextResponse.json(
        {
          success: false,
          error: "Email and name are required",
        },
        { status: 400 },
      );
    }

    // Get the Loops API key from environment variables
    const loopsApiKey = process.env.LOOPS_API_KEY;

    if (!loopsApiKey) {
      console.error("Missing LOOPS_API_KEY in environment variables");
      // Return success to prevent blocking the registration flow
      // but log the error server-side
      return NextResponse.json({ success: true });
    }

    // Prepare the payload for Loops API
    const loopsPayload = {
      email: body.email,
      firstName: body.name,
      userGroup: "Registered",
      source: "Mini App",
      mailingLists: {
        cm6axdb5f00uq0kl7ha09gi4v: true,
        cm6ybnkua00yq0lkyfcvwals5: true,
      },
    };

    // Send request to Loops API
    const response = await fetch(
      "https://app.loops.so/api/v1/contacts/update",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${loopsApiKey}`,
        },
        body: JSON.stringify(loopsPayload),
      },
    );

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Loops API error:", responseData);
      // Return success to prevent blocking the registration flow
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating Loops:", error);
    // Return success to prevent blocking the registration flow
    return NextResponse.json({ success: true });
  }
}
