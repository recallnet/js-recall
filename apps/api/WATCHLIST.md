# Watchlist Integration

This document describes the Chainalysis watchlist integration for preventing sanctioned wallet addresses from using the platform.

## Overview

The watchlist integration uses the Chainalysis API to check wallet addresses against sanctions lists during user registration and wallet linking operations.

## Features

- **Fail-safe Design**: If the Chainalysis API is unavailable or misconfigured, the system allows access rather than blocking legitimate users
- **Comprehensive Coverage**: Checks both primary wallet addresses and embedded wallet addresses
- **Real-time Checking**: Validates addresses at the point of registration and wallet linking
- **Proper Error Handling**: Graceful degradation when external services are unavailable

## Configuration

Add your Chainalysis API key to your environment variables:

```bash
CHAINALYSIS_API_KEY=your_chainalysis_api_key_here
```

## Implementation Details

### Service Layer

The `WatchlistService` (`src/services/watchlist.service.ts`) handles all interactions with the Chainalysis API:

- Configurable API key
- Timeout handling (10 seconds)
- Request caching considerations
- Fail-safe error handling

### Integration Points

1. **User Registration** (`UserManager.registerUser`):

   - Checks primary wallet address
   - Checks embedded wallet address (if provided)
   - Blocks registration if any address is sanctioned

2. **Wallet Linking** (`UserController.linkWallet`):
   - Validates new wallet address before linking
   - Returns 403 error for sanctioned addresses

### Health Monitoring

The watchlist service status is included in the health endpoint:

```
GET /api/health/detailed
```

Response includes:

```json
{
  "services": {
    "watchlistService": "ok" | "not_configured"
  }
}
```

## Error Responses

When a sanctioned address is detected:

- **Status Code**: 403 Forbidden
- **Error Message**: "This wallet address is not permitted for use on this platform"

## Testing

Comprehensive test coverage includes:

- Service unit tests (`src/services/__tests__/watchlist.service.test.ts`)
- Integration tests (`src/services/__tests__/user-manager.watchlist.test.ts`)
- Mock scenarios for various API responses
- Timeout and error handling tests

Run tests:

```bash
pnpm test watchlist
```

## Security Considerations

- API keys are server-side only and not exposed to clients
- Case-insensitive address handling (normalized to lowercase)
- Fail-safe behavior prioritizes availability over blocking
- Comprehensive logging for compliance and debugging

## Monitoring

The service logs important events:

- Configuration warnings when API key is missing
- Sanctioned address detections (for compliance reporting)
- API errors and timeouts
- Service status checks

## Production Deployment

Before deploying to production:

1. Set `CHAINALYSIS_API_KEY` environment variable
2. Verify health endpoint shows `watchlistService: "ok"`
3. Test with known sanctioned addresses
4. Monitor logs for proper operation
5. Set up alerting for service failures

## Future Enhancements

Potential improvements:

- Address result caching with TTL
- Background re-checking of existing users
- Multiple watchlist provider support
- Enhanced compliance reporting
- Rate limiting and request throttling
