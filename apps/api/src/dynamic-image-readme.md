# Dynamic Competition OG Image Generation Service

This document outlines the architecture of the dynamic Open Graph (OG) image generation service for competitions. This service generates images on-the-fly, providing rich, context-specific previews when competition links are shared on social media and other platforms.

## Architecture

The service is built as an API endpoint within the `apps/api` application. It uses the `satori` library to convert a JSX template into an SVG image, which is then returned as a PNG image. This approach allows for a component-based, maintainable design for the OG image.

The flow of the service is as follows:

1.  A request is made to the API endpoint: `/api/competitions/{competitionId}/og-image`.
2.  The API endpoint fetches the competition data from the database using the `competitionId`.
3.  The competition data is used to populate a JSX template (`apps/api/src/og-templates/competition-og-template.tsx`).
4.  Custom fonts and assets (SVGs, images) are loaded from the local filesystem, converted to be embedded directly into the image.
5.  `satori` renders the JSX into an SVG.
6.  The SVG is converted to a PNG image.
7.  The API endpoint returns the generated PNG image with the `Content-Type` header set to `image/png`.

## Implementation Details

1.  **API Endpoint:** The route is defined in `apps/api/src/modules/v1/competition/competition.controller.ts`, handling requests to `/api/competitions/{competitionId}/og-image`.

2.  **Fetch Competition Data:** The `getCompetitionOgImage` method in the controller fetches the necessary competition details.

3.  **JSX Template:** The visual structure of the OG image is defined in `apps/api/src/og-templates/competition-og-template.tsx`. This file contains a React-like component that designs the image using JSX and CSS-in-JS.

4.  **Image Generation:** The controller uses `satori` to process the JSX template. It loads fonts and converts assets to Base64 data URLs to embed them directly in the generated image. The final output is a PNG.

5.  **Frontend:** The `apps/comps` application generates metadata for competition pages. The `generateMetadata` function in `apps/comps/app/competitions/[id]/page.tsx` is configured to use the dynamic image URL (e.g., `https://app.recall.network/api/competitions/{competitionId}/og-image`).

## Testing Strategy

### Local Testing

The API endpoint can be tested locally by running the `apps/api` service and accessing the endpoint URL directly in a browser (e.g., `http://localhost:3000/api/competitions/{competitionId}/og-image`). This will render the generated PNG image.

### Production Testing

To test in a production environment, you can use any tool that previews URL metadata. The production URL for the OG image is public.

1.  **Construct the URL:** Create the full URL for a competition's OG image, for example: `https://app.recall.network/api/competitions/9e0140df-06b6-4fe1-a5e8-5bf523c09808/og-image`.
2.  **Use a URL Previewer:**
    - **Social Media:** Paste the competition URL (e.g., `https://app.recall.network/competitions/9e0140df-06b6-4fe1-a5e8-5bf523c09808`) into a post on Twitter, Discord, or Telegram. The platform will fetch the metadata and display the OG image.
    - **Online Tools:** Use a tool like [Twitter Card Validator](https://cards-dev.twitter.com/validator) or [metatags.io](https://metatags.io/) to see how the OG image is rendered.
