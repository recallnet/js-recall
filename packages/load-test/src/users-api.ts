export const config = {
  target: "{{ $env.API_HOST }}",
  phases: [
    {
      duration: "1m",
      arrivalCount: "100",
      name: "warmup",
    },
    {
      duration: "5m",
      arrivalRate: "50",
      maxVusers: "{{ $env.USERS_COUNT }}",
      name: "load-test",
    },
  ],
  environments: {
    test: {
      target: "{{ $env.API_HOST }}",
    },
  },
  plugins: {
    "metrics-by-endpoint": {},
  },
};

export const scenarios = [
  {
    name: "Leaderboard",
    flow: [
      {
        get: {
          url: "/api/leaderboard?limit=10&offset=0&type=trading",
        },
      },
      { think: 1 },
      {
        get: {
          url: "/api/leaderboard?limit=10&offset=10&type=trading",
        },
      },
      { think: 1 },
      {
        get: {
          url: "/api/leaderboard?limit=10&offset=20&type=trading",
        },
      },
    ],
  },
  {
    name: "Competitions Hub",
    flow: [
      {
        parallel: [
          {
            get: {
              url: "/api/leaderboard?limit=25&type=trading",
            },
          },
          {
            get: {
              url: "/api/competitions?status=active",
              capture: {
                json: "$.competitions[0].id",
                as: "activeCompetitionId",
                strict: false,
              },
            },
          },
          {
            get: {
              url: "/api/competitions?status=pending",
              capture: {
                json: "$.competitions[0].id",
                as: "pendingCompetitionId",
                strict: false,
              },
            },
          },
          {
            get: {
              url: "/api/competitions?status=ended",
              capture: {
                json: "$.competitions[0].id",
                as: "endedCompetitionId",
                strict: false,
              },
            },
          },
        ],
      },
      { think: 1 },
      {
        get: {
          ifTrue: "activeCompetitionId",
          url: "/api/competitions/{{ activeCompetitionId }}/agents",
        },
      },
      {
        get: {
          ifTrue: "pendingCompetitionId",
          url: "/api/competitions/{{ pendingCompetitionId }}/agents",
        },
      },
      {
        get: {
          ifTrue: "endedCompetitionId",
          url: "/api/competitions/{{ endedCompetitionId }}/agents",
        },
      },
    ],
  },
  {
    name: "Active Competition",
    flow: [
      {
        get: {
          url: "/api/competitions?status=active",
          capture: {
            json: "$.competitions[0].id",
            as: "activeCompetitionId",
            strict: false,
          },
        },
      },
      { think: 1 },
      {
        get: {
          ifTrue: "activeCompetitionId",
          url: "/api/competitions/{{ activeCompetitionId }}",
        },
      },
    ],
  },
];
