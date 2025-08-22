export const config = {
  target: "{{ $env.API_HOST }}",
  phases: [
    {
      duration: "1m",
      arrivalCount: "{{ $env.AGENTS_COUNT }}",
      maxVusers: "{{ $env.AGENTS_COUNT }}",
    },
  ],
  processor: "../src/agent-helpers.ts",
  environments: {
    test: {
      target: "{{ $env.API_HOST }}",
      variables: {
        usdcToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        wethToken: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      },
    },
  },
};

export const before = {
  flow: [
    {
      get: {
        url: "/api/competitions/status",
        headers: {
          Authorization: "Bearer {{ $env.ADMIN_API_KEY }}",
        },
        capture: [
          {
            json: "$.active",
            as: "activeCompetition",
          },
          {
            json: "$.competition.id",
            as: "activeCompetitionId",
            strict: false,
          },
        ],
      },
    },
    {
      post: {
        ifTrue: "activeCompetition",
        url: "/api/admin/competition/end",
        headers: {
          Authorization: "Bearer {{ $env.ADMIN_API_KEY }}",
        },
        json: {
          competitionId: "{{ activeCompetitionId }}",
        },
      },
    },
    {
      post: {
        url: "/api/admin/competition/create",
        headers: {
          Authorization: "Bearer {{ $env.ADMIN_API_KEY }}",
        },
        beforeRequest: "setCompetitionPayload",
        json: {},
        capture: {
          json: "$.competition.id",
          as: "competitionId",
        },
      },
    },
    {
      count: "{{ $env.AGENTS_COUNT }}",
      loop: [
        {
          post: {
            beforeRequest: "generateRandomUserAndAgent",
            url: "/api/admin/users",
            headers: {
              Authorization: "Bearer {{ $env.ADMIN_API_KEY }}",
            },
            json: {
              walletAddress: "{{ walletAddress }}",
              name: "{{ userName }}",
              email: "{{ userEmail }}",
              userImageUrl: "{{ userImageUrl }}",
              userMetadata: "{{ userMetadata }}",
              agentName: "{{ agentName }}",
              agentHandle: "{{ agentHandle }}",
              agentDescription: "{{ agentDescription }}",
              agentImageUrl: "{{ agentImageUrl }}",
              agentMetadata: "{{ agentMetadata }}",
              agentWalletAddress: "{{ agentWalletAddress }}",
            },
            capture: {
              json: "$.agent.id",
              as: "agentId",
            },
            afterResponse: "extractUserAndAgentInfo",
          },
        },
        {
          post: {
            url: "/api/admin/competitions/{{ competitionId }}/agents/{{ agentId }}",
            headers: {
              Authorization: "Bearer {{ $env.ADMIN_API_KEY }}",
            },
          },
        },
      ],
    },
    {
      post: {
        url: "/api/admin/competition/start",
        headers: {
          Authorization: "Bearer {{ $env.ADMIN_API_KEY }}",
        },
        json: {
          competitionId: "{{ competitionId }}",
        },
      },
    },
  ],
};

export const scenarios = [
  {
    name: "Agent Trading",
    beforeScenario: "beforeTrade",
    flow: [
      {
        log: "Starting agent trading scenario",
      },
      {
        count: 50, // 5.000 USDC / 100 buy trades
        loop: [
          {
            post: {
              url: "/api/trade/execute",
              headers: {
                Authorization: "Bearer {{ apiKey }}",
              },
              json: {
                fromToken: "{{ usdcToken }}",
                toToken: "{{ wethToken }}",
                amount: "100",
                reason: "Buy WETH",
                fromChain: "EVM",
                toChain: "EVM",
              },
            },
          },
          {
            think: 1,
          },
          {
            post: {
              url: "/api/trade/execute",
              headers: {
                Authorization: "Bearer {{ apiKey }}",
              },
              json: {
                fromToken: "{{ wethToken }}",
                toToken: "{{ usdcToken }}",
                amount: "0.00001",
                reason: "Sell WETH",
                fromChain: "EVM",
                toChain: "EVM",
              },
            },
          },
          {
            think: 1,
          },
        ],
      },
    ],
  },
];
