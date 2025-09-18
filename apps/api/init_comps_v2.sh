#!/bin/bash

# Script to automate Trading Simulator setup and basic operations

# --- Configuration ---
# First argument: Admin API Key (Required)
# Second argument: Number of users/agents to create (Optional, defaults to 2; max valid keys is 20)
# Third argument: Base URL (Optional, defaults to http://localhost:3000)
ADMIN_API_KEY="${1}"
NUM_USERS="${2:-10}"
if [ "$NUM_USERS" -gt 10 ]; then
  echo "WARNING: Only the first 20 users and agents combined have valid wallet key pairs."
fi
BASE_URL="${3:-http://localhost:3000}"

# Tokens for trade - ensure these are valid for your setup
# Example: USDC on Solana and WETH on Ethereum
FROM_TOKEN_ADDRESS="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" # e.g., USDC (Solana)
TO_TOKEN_ADDRESSES=(
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"     # WETH (Ethereum)
  "0x514910771AF9Ca656af840dff83E8264EcF986CA"     # LINK (Ethereum)
  "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"     # AAVE (Ethereum)
  "0x44ff8620b8cA30902395A7bD3F2407e1A091BF73"     # VIRTUAL (Ethereum)
  "0xD533a949740bb3306d119CC777fa900bA034cd52"     # CRV (Ethereum)
)
TRADE_AMOUNT=$(shuf -i 100-500 -n 1) # A random amount between 100 and 500
UTC_NOW=$(date -u +'%Y-%m-%dT%H:%M:%SZ') # ISO format for admin API dates

# Pre-generated Ethereum key pairs (cryptographically correct)
declare -a PRIVATE_KEYS=(
  "245d7c00aecdcb0cd4db34d34b3428626a93d139bd723f9ed3d0f11e124ef34b"
  "d177374d13e30fae38075710283673ff81f9367c6487672adee4670f2c5d2ad3"
  "0967d704e5eb9b5529f818b664c354f8e8f527450024937f361b296785f56ca3"
  "12fa97b58bcbf9d92dde01c37698630d5dc2d9f3a79fbeda514cdfb2476d3441"
  "381371e0574085bd542c545680ca76537a86add6f9ad6b3fd845cb6141ea6ba1"
  "069107a698de0da0b50ca82683a5bcfe23d73589e7feea01411cbe97c2becfd0"
  "54ac2e51d8c8a77102a0fcd1e5e6b0a702e41074aecbe6609896547bc712a769"
  "23a3080c41cd76a32fd216a537e95172a67988e1c14439d4e3ad1ace757c8cef"
  "4eb4e8c88c005ccac0e1b185203a15a33956774978788967ade874d5bd63982f"
  "197528d1e7e313f477010a8b8693be339ef56c681928b1ecd02762a7ffd6276b"
  "54970ed328b62e9764187da2246a8057d8d03c34ac563d12d5a6ec06745c2434"
  "90bb0658b10a4500b931e1645d97513c9aefa08a51731aa317008df87fdbaa11"
  "42921b1031b57cf03c418ea4c48f0bf36af641c488ce33c254d9048382fa7fcf"
  "118740db73c1bd4c4fef065c98626645a2f2241de9db3545816ebfa02847013b"
  "9c1d00f79534d360b6cc6971461dbda6def870d5b529c35994c9736614ded845"
  "18d959c231df8e6bb802e5a63bb62fc83174a74517cdff85bf7dde41c2fff1a1"
  "5881c6f8de01bff6eff530031ef42a39bc24b43fb07284663c1b0a48d2b18401"
  "89b7e0b9c3d6f75ec70c8d44d906d09855316bc36a7c670e2a33a822891f87ae"
  "5130ef318c9083b56db7dfde775e201602479d8625378b94c51d399a3e96aa4e"
  "a2fe520bb7e665e3e3cff6026158bf5909b4bcffc11646f12b94cf77cc40238a"
)

declare -a ADDRESSES=(
  "0xe6c7fa6d30be490cc3c79be5ae59a2cd2afe82f4"
  "0xf8c46a6c54b8fb978ae18a5d015afdc96a66fd06"
  "0x0556beb7500dc6934cb37eedbd4a92967a83be75"
  "0x7d32669a486b915d25809f09746391a7df971668"
  "0x54ed954b7eef0cc1259e4787422ba2ce81b9fd09"
  "0xb9f70be13de98aa1bc53072fe3c7e52ed737e535"
  "0xd7009050f831ee966dc0d5649ff47c2c7f4d4bd6"
  "0xa448a3e57f5f59a88ae7b6803ad6b99f40349598"
  "0x7c95cc033708f9d07ab5255214bdf94f610e6267"
  "0xde4bcbd7f6d4bab0cead5f92aa2fabfab0a42ab9"
  "0x2f37ff46e3f584c4ad4c1e781ad632db10621e35"
  "0xc97facc72dc5e30a56cfaf1bb3c5c07d2358f54a"
  "0xbfdc60b1fc05e917e65841bb776c7f69a1f27b7d"
  "0xf700bf6323ae3228ca001abe71eaf0f9d9682343"
  "0x3dc7d6d609f8bc0cb719d54cde793727f1b78f76"
  "0xcbb61d5bfc9327b21ae9d6e3c9d2807049071796"
  "0x69f2370b04733a726edfe8e9ed32b7c518d3211c"
  "0x33bf1bc7b28b9be86f7ff171d37e40bb21a25342"
  "0x9909e7c866e4cd165910c5ae7119d316d7739636"
  "0x8b389fa9b51f58426e5107ffe0ed4de36f48337c"
)

# --- Helper Function for logging ---
log_step() {
  echo ""
  echo "--------------------------------------------------"
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
  echo "--------------------------------------------------"
}

# Get pre-generated wallet address and private key by index
get_wallet_address_and_private_key() {
  local index=$1
  if [ "$index" -ge 20 ]; then
    echo "WARNING: Generating random wallet address for index $index (no valid private key available)" >&2
    local private_key="N/A"
    local wallet="0x$(openssl rand -hex 20)"  # 20 bytes = 40 hex chars for Ethereum address
    echo "{\"privateKey\": \"$private_key\", \"wallet\": \"$wallet\"}"
    return 0
  fi
  local private_key="${PRIVATE_KEYS[$index]}"
  local wallet="${ADDRESSES[$index]}"
  echo "{\"privateKey\": \"$private_key\", \"wallet\": \"$wallet\"}"
}

# --- Argument Check ---
if [ -z "$ADMIN_API_KEY" ]; then
  echo "Usage: $0 <ADMIN_API_KEY> [NUM_USERS] [BASE_URL]"
  echo "Example: $0 your_admin_api_key 5 http://localhost:3000"
  exit 1
fi

log_step "Initial Configuration"
echo "Using ADMIN_API_KEY: ${ADMIN_API_KEY:0:5}..." # Show only a part for brevity/safety in logs
echo "Using BASE_URL: $BASE_URL"
echo "Creating $NUM_USERS users and agents"

trading_constraints=$(cat <<EOF
{
  "minimumPairAgeHours": 0,
  "minimum24hVolumeUsd": 0,
  "minimumLiquidityUsd": 0,
  "minimumFdvUsd": 0
}
EOF
)

# --- Step 1: Create First Competition (to be ended) ---
log_step "Step 1: Creating First Competition"
COMPETITION_1_NAME="Automated Competition 1 $UTC_NOW"
COMPETITION_1_PAYLOAD=$(cat <<EOF
{
  "name": "$COMPETITION_1_NAME",
  "description": "First competition created by script, will be ended.",
  "tradingType": "allow",
  "type": "trading",
  "sandboxMode": true,
  "startDate": "$UTC_NOW",
  "votingStartDate": "$UTC_NOW",
  "externalUrl": "https://recall.network",
  "imageUrl": "https://fastly.picsum.photos/id/381/200/200.jpg?hmac=IXUwJuDt0wy3ChotTk60XiBv1aDqt3EbITLD8z4671w",
  "tradingConstraints": $trading_constraints
}
EOF
)
COMPETITION_1_RESPONSE=$(curl -s -X POST \
  "$BASE_URL/api/admin/competition/create" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d "$COMPETITION_1_PAYLOAD")

COMPETITION_ID_1=$(echo "$COMPETITION_1_RESPONSE" | jq -r '.competition.id')
if [ "$COMPETITION_ID_1" == "null" ] || [ -z "$COMPETITION_ID_1" ]; then
  echo "ERROR: Failed to create Competition 1."
  echo "Response: $COMPETITION_1_RESPONSE"
  exit 1
fi
echo "Competition 1 created successfully. ID: $COMPETITION_ID_1"

# --- Step 2: Create Users and Agents ---
log_step "Step 2: Creating $NUM_USERS Users and Agents"

# Arrays to store created IDs
declare -a USER_IDS
declare -a USER_EMAILS
declare -a AGENT_IDS
declare -a AGENT_HANDLES
declare -a AGENT_API_KEYS
declare -a USER_WALLETS
declare -a USER_PRIVATE_KEYS
declare -a AGENT_WALLETS
declare -a AGENT_PRIVATE_KEYS

for i in $(seq 0 $(($NUM_USERS-1))); do
  USER_NAME="User ${i}"
  USER_EMAIL="user${i}@example.com"
  AGENT_NAME="Agent ${i}"
  AGENT_HANDLE="agent_${i}"
  USER_WALLET_AND_PRIVATE_KEY=$(get_wallet_address_and_private_key $i)
  USER_WALLET=$(echo "$USER_WALLET_AND_PRIVATE_KEY" | jq -r '.wallet')
  USER_PRIVATE_KEY=$(echo "$USER_WALLET_AND_PRIVATE_KEY" | jq -r '.privateKey')
  AGENT_WALLET_AND_PRIVATE_KEY=$(get_wallet_address_and_private_key $(($i + 1)))
  AGENT_WALLET=$(echo "$AGENT_WALLET_AND_PRIVATE_KEY" | jq -r '.wallet')
  AGENT_PRIVATE_KEY=$(echo "$AGENT_WALLET_AND_PRIVATE_KEY" | jq -r '.privateKey')

  USER_AGENT_PAYLOAD=$(cat <<EOF
{
  "name": "$USER_NAME",
  "email": "$USER_EMAIL",
  "walletAddress": "$USER_WALLET",
  "agentName": "$AGENT_NAME",
  "agentDescription": "Agent automatically created by script for $USER_NAME",
  "agentWalletAddress": "$AGENT_WALLET"
}
EOF
)
  USER_AGENT_RESPONSE=$(curl -s -X POST \
    "$BASE_URL/api/admin/users" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $ADMIN_API_KEY" \
    -d "$USER_AGENT_PAYLOAD")

  USER_ID=$(echo "$USER_AGENT_RESPONSE" | jq -r '.user.id')
  USER_EMAIL=$(echo "$USER_AGENT_RESPONSE" | jq -r '.user.email')
  AGENT_ID=$(echo "$USER_AGENT_RESPONSE" | jq -r '.agent.id')
  AGENT_HANDLE=$(echo "$USER_AGENT_RESPONSE" | jq -r '.agent.handle')
  AGENT_API_KEY=$(echo "$USER_AGENT_RESPONSE" | jq -r '.agent.apiKey')

  if [ "$USER_ID" == "null" ] || [ -z "$USER_ID" ] || \
     [ "$AGENT_ID" == "null" ] || [ -z "$AGENT_ID" ] || \
     [ "$AGENT_API_KEY" == "null" ] || [ -z "$AGENT_API_KEY" ]; then
    echo "ERROR: Failed to create User and Agent pair $i."
    echo "Response: $USER_AGENT_RESPONSE"
    continue
  fi

  USER_IDS+=("$USER_ID")
  AGENT_IDS+=("$AGENT_ID")
  USER_EMAILS+=("$USER_EMAIL")
  AGENT_HANDLES+=("$AGENT_HANDLE")
  AGENT_API_KEYS+=("$AGENT_API_KEY")
  USER_WALLETS+=("$USER_WALLET")
  USER_PRIVATE_KEYS+=("$USER_PRIVATE_KEY")
  AGENT_WALLETS+=("$AGENT_WALLET")
  AGENT_PRIVATE_KEYS+=("$AGENT_PRIVATE_KEY")
  
  echo "Created User $i (ID: $USER_ID) and Agent $i (ID: $AGENT_ID)"
  echo "User Wallet: $USER_WALLET"
  echo "User Email: $USER_EMAIL"
  echo "User Private Key: $USER_PRIVATE_KEY"
  echo "Agent Handle: $AGENT_HANDLE"
  echo "Agent Wallet: $AGENT_WALLET"
  echo "Agent Private Key: $AGENT_PRIVATE_KEY"
done

# --- Step 3: Start the First Competition with all Agents ---
log_step "Step 3: Starting Competition 1 ($COMPETITION_ID_1) with all Agents"

# Convert AGENT_IDS array to JSON array
AGENT_IDS_JSON=$(printf '%s\n' "${AGENT_IDS[@]}" | jq -R . | jq -s .)

START_COMPETITION_PAYLOAD=$(cat <<EOF
{
  "competitionId": "$COMPETITION_ID_1",
  "agentIds": $AGENT_IDS_JSON
}
EOF
)

START_COMPETITION_RESPONSE=$(curl -s -X POST \
  "$BASE_URL/api/admin/competition/start" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d "$START_COMPETITION_PAYLOAD")

STARTED_COMP_SUCCESS=$(echo "$START_COMPETITION_RESPONSE" | jq -r '.success')
if [ "$STARTED_COMP_SUCCESS" != "true" ]; then
    echo "WARNING: Could not confirm Competition 1 was started successfully or response format unexpected."
    echo "Response: $START_COMPETITION_RESPONSE"
else
    echo "Competition 1 started successfully with ${#AGENT_IDS[@]} agents."
fi

# --- Step 4: Each Agent Makes a Trade in Competition 1 ---
log_step "Step 4: Each Agent making a trade in Competition 1 using their API Keys"

for i in "${!AGENT_IDS[@]}"; do
  AGENT_ID="${AGENT_IDS[$i]}"
  AGENT_API_KEY="${AGENT_API_KEYS[$i]}"
  TO_TOKEN_ADDRESS="${TO_TOKEN_ADDRESSES[$((i % ${#TO_TOKEN_ADDRESSES[@]}))]}" # Randomly select a token from the array
  
  TRADE_REASON="Automated trade by agent $i in Competition 1 $(date +%s)"
  TRADE_PAYLOAD=$(cat <<EOF
{
  "fromToken": "$FROM_TOKEN_ADDRESS",
  "toToken": "$TO_TOKEN_ADDRESS",
  "amount": "$TRADE_AMOUNT",
  "reason": "$TRADE_REASON",
  "fromChain": "svm",
  "toChain": "eth"
}
EOF
)
  TRADE_RESPONSE=$(curl -s -X POST \
    "$BASE_URL/api/trade/execute" \
    -H "Authorization: Bearer $AGENT_API_KEY" \
    -H 'Content-Type: application/json' \
    -d "$TRADE_PAYLOAD")

  TRADE_SUCCESS=$(echo "$TRADE_RESPONSE" | jq -r '.success')
  TRADE_ID=$(echo "$TRADE_RESPONSE" | jq -r '.transaction.id')

  if [ "$TRADE_SUCCESS" != "true" ]; then
    echo "WARNING: Trade execution for Agent $i in Competition 1 may have failed."
    echo "Response: $TRADE_RESPONSE"
  else
    echo "Trade executed for Agent $i in Competition 1. Transaction ID: $TRADE_ID"
  fi
# Small delay between trades
  sleep 1
done

# --- Step 5: End Competition 1 ---
log_step "Step 5: Ending Competition 1 ($COMPETITION_ID_1)"
END_COMPETITION_PAYLOAD=$(cat <<EOF
{
  "competitionId": "$COMPETITION_ID_1"
}
EOF
)

END_COMPETITION_RESPONSE=$(curl -s -X POST \
  "$BASE_URL/api/admin/competition/end" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d "$END_COMPETITION_PAYLOAD")

END_COMP_SUCCESS=$(echo "$END_COMPETITION_RESPONSE" | jq -r '.success')
if [ "$END_COMP_SUCCESS" != "true" ]; then
    echo "WARNING: Could not confirm Competition 1 was ended successfully or response format unexpected."
    echo "Response: $END_COMPETITION_RESPONSE"
else
    echo "Competition 1 ended successfully."
fi

# --- Step 6: Create Second Competition (to be kept active) ---
log_step "Step 6: Creating Second Competition"
COMPETITION_2_NAME="Automated Competition 2 $UTC_NOW"
COMPETITION_2_PAYLOAD=$(cat <<EOF
{
  "name": "$COMPETITION_2_NAME",
  "description": "Second competition created by script, will be kept active.",
  "tradingType": "allow",
  "type": "trading",
  "sandboxMode": true,
  "startDate": "$UTC_NOW",
  "votingStartDate": "$UTC_NOW",
  "externalUrl": "https://recall.network",
  "imageUrl": "https://fastly.picsum.photos/id/381/200/200.jpg?hmac=IXUwJuDt0wy3ChotTk60XiBv1aDqt3EbITLD8z4671w",
  "tradingConstraints": $trading_constraints
}
EOF
)
COMPETITION_2_RESPONSE=$(curl -s -X POST \
  "$BASE_URL/api/admin/competition/create" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d "$COMPETITION_2_PAYLOAD")

COMPETITION_ID_2=$(echo "$COMPETITION_2_RESPONSE" | jq -r '.competition.id')
if [ "$COMPETITION_ID_2" == "null" ] || [ -z "$COMPETITION_ID_2" ]; then
  echo "ERROR: Failed to create Competition 1."
  echo "Response: $COMPETITION_2_RESPONSE"
  exit 1
fi
echo "Competition 2 created successfully. ID: $COMPETITION_ID_2"

# --- Step 7: Start the Second Competition with all Agents ---
log_step "Step 7: Starting Competition 2 ($COMPETITION_ID_2) with all Agents"

# Convert AGENT_IDS array to JSON array
AGENT_IDS_JSON=$(printf '%s\n' "${AGENT_IDS[@]}" | jq -R . | jq -s .)

START_COMPETITION_PAYLOAD=$(cat <<EOF
{
  "competitionId": "$COMPETITION_ID_2",
  "agentIds": $AGENT_IDS_JSON
}
EOF
)

START_COMPETITION_RESPONSE=$(curl -s -X POST \
  "$BASE_URL/api/admin/competition/start" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d "$START_COMPETITION_PAYLOAD")

STARTED_COMP_SUCCESS=$(echo "$START_COMPETITION_RESPONSE" | jq -r '.success')
if [ "$STARTED_COMP_SUCCESS" != "true" ]; then
    echo "WARNING: Could not confirm Competition 2 was started successfully or response format unexpected."
    echo "Response: $START_COMPETITION_RESPONSE"
else
    echo "Competition 2 started successfully with ${#AGENT_IDS[@]} agents."
fi

# --- Step 8: Each Agent Makes a Trade in Competition 2 ---
log_step "Step 8: Each Agent making a trade in Competition 2 using their API Keys"

for i in "${!AGENT_IDS[@]}"; do
  AGENT_ID="${AGENT_IDS[$i]}"
  AGENT_API_KEY="${AGENT_API_KEYS[$i]}"
  TO_TOKEN_ADDRESS="${TO_TOKEN_ADDRESSES[$((i % ${#TO_TOKEN_ADDRESSES[@]}))]}" # Randomly select a token from the array
  
  TRADE_REASON="Automated trade by agent $i in Competition 2 $(date +%s)"
  TRADE_PAYLOAD=$(cat <<EOF
{
  "fromToken": "$FROM_TOKEN_ADDRESS",
  "toToken": "$TO_TOKEN_ADDRESS",
  "amount": "$TRADE_AMOUNT",
  "reason": "$TRADE_REASON",
  "fromChain": "svm",
  "toChain": "eth"
}
EOF
)
  TRADE_RESPONSE=$(curl -s -X POST \
    "$BASE_URL/api/trade/execute" \
    -H "Authorization: Bearer $AGENT_API_KEY" \
    -H 'Content-Type: application/json' \
    -d "$TRADE_PAYLOAD")

  TRADE_SUCCESS=$(echo "$TRADE_RESPONSE" | jq -r '.success')
  TRADE_ID=$(echo "$TRADE_RESPONSE" | jq -r '.transaction.id')

  if [ "$TRADE_SUCCESS" != "true" ]; then
    echo "WARNING: Trade execution for Agent $i in Competition 2 may have failed."
    echo "Response: $TRADE_RESPONSE"
  else
    echo "Trade executed for Agent $i in Competition 2. Transaction ID: $TRADE_ID"
  fi
# Small delay between trades
  sleep 1
done

# --- Step 9: Create Third Competition (to remain pending) ---
log_step "Step 9: Creating Third Competition (to remain pending)"
COMPETITION_3_NAME="Automated Competition 3 Pending $(date +%s)"
COMPETITION_3_PAYLOAD=$(cat <<EOF
{
  "name": "$COMPETITION_3_NAME",
  "description": "Third competition created by script, should remain pending.",
  "tradingType": "disallowAll",
  "type": "trading",
  "externalUrl": "https://recall.network",
  "imageUrl": "https://fastly.picsum.photos/id/237/200/300.jpg?hmac=TmmQSbShHz9CdQm0NkEjx1Dyh_Y984R9LpNrpvH2D_U",
  "tradingConstraints": $trading_constraints
}
EOF
)
COMPETITION_3_RESPONSE=$(curl -s -X POST \
  "$BASE_URL/api/admin/competition/create" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d "$COMPETITION_3_PAYLOAD")

COMPETITION_ID_3=$(echo "$COMPETITION_3_RESPONSE" | jq -r '.competition.id')
if [ "$COMPETITION_ID_3" == "null" ] || [ -z "$COMPETITION_ID_3" ]; then
  echo "ERROR: Failed to create Competition 3."
  echo "Response: $COMPETITION_3_RESPONSE"
else
  echo "Competition 3 (pending) created successfully. ID: $COMPETITION_ID_3"
fi

# --- Step 10: Log Summary Information ---
log_step "Summary of Operations"
echo "================== SUMMARY =================="
echo "Base URL:                 $BASE_URL"
echo "Admin API Key (Provided): Used (partially hidden)"
echo "Number of Users/Agents:   $NUM_USERS"
echo ""
echo "Created Users/Agents:"
for i in "${!USER_IDS[@]}"; do
  echo "Pair $i:"
  echo "  User ID:              ${USER_IDS[$i]}"
  echo "  User Wallet:          ${USER_WALLETS[$i]}"
  echo "  User Private Key:     ${USER_PRIVATE_KEYS[$i]}"
  echo "  Agent ID:             ${AGENT_IDS[$i]}"
  echo "  Agent Handle:         ${AGENT_HANDLES[$i]}"
  echo "  Agent API Key:        ${AGENT_API_KEYS[$i]}"
  echo "  Agent Wallet:         ${AGENT_WALLETS[$i]}"
  echo "  Agent Private Key:    ${AGENT_PRIVATE_KEYS[$i]}"
done
echo ""
echo "Competition 1 ID (Ended):  $COMPETITION_ID_1"
echo "Competition 2 ID (Active): ${COMPETITION_ID_2:-N/A}"
echo "Competition 3 ID (Pending): ${COMPETITION_ID_3:-N/A}"
echo ""
echo "============================================="
echo ""
echo "Copy and paste the following into your .env file:"
echo ""
echo "export ADMIN_API_KEY=${ADMIN_API_KEY}"
echo "export AGENT_ID=${AGENT_IDS[0]}"
echo "export AGENT_HANDLE=${AGENT_HANDLES[0]}"
echo "export AGENT_API_KEY=${AGENT_API_KEYS[0]}"
echo "export USER_WALLET=${USER_WALLETS[0]}"
echo "export USER_PRIVATE_KEY=${USER_PRIVATE_KEYS[0]}"
echo "export AGENT_WALLET=${AGENT_WALLETS[0]}"
echo "export AGENT_PRIVATE_KEY=${AGENT_PRIVATE_KEYS[0]}"
echo "export COMPETITION_ID=${COMPETITION_ID_2}" # Active competition

log_step "Script Finished."
