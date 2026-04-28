# Cycling Coach

AI-powered cycling coach for Strava users. Personalized weekly training plans, ride feedback, and route suggestions, generated with Claude.

Status: in active development. Currently single-user (pending Strava API multi-user approval).

## Tech stack

- Cloudflare Workers (serverless compute)
- Cloudflare D1 (SQLite at the edge)
- Strava API (activity data, OAuth)
- Anthropic Claude API (AI generation, BYOK - users provide their own key)

## Local development

Requires Node.js v22+, a Cloudflare account, and Strava API credentials in .dev.vars.

    npm install
    npx wrangler dev

## Deployment

Push to main branch. Cloudflare Workers Builds picks up changes and deploys automatically via CI/CD.

## Status

- MVP working end-to-end (single user)
- CI/CD pipeline live
- D1 database schema deployed
- Migration from localStorage to D1 in progress
- Strava API multi-user approval pending

## License

Personal project, not licensed for public reuse.