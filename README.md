
# Proof of Concept System and Docker Container Power Monitoring

## Structure

- Monitoring script: `src/scripts/monitor.ts`
- Analysis script: `src/scripts/calc-analysis.ts`
- Config to specify what Docker containers to monitor: `config.json` (example: `config.example.json`)
- Config to specify for what segments of measurements to compute statistics for and what was measured in them / what use they represent: `analysis-tasks.json` (example: `analysis-tasks.example.json`)
- Ingest route: `src/app/ingest/route.ts`
- Routes for data access in Grafana:
  - `src/app/data/route.ts` for raw measurements
  - `src/app/container/route.ts` for Docker containers
  - `src/app/insights/route.ts` for computed insights
- Environment variables: `.env.local` (example: `.env.example`)

## Setup and Usage

1. Install Node.js and Docker on your system.
2. Run `npm install` to install dependencies for Next.js and the monitoring and analysis script
3. Run `docker compose up -d` to start MongoDB and Grafana
4. Copy `.env.example` to `.env.local` and set environment variables, e.g.
   - `MONGO_URI=mongodb://mongo:mongo@localhost:27117` (default for this setup)
   - `SOURCE_ID=machine-01` (can be whatever you want, something to identify the machine on which the measurements are performed)
   - `VERSION_ID=v1` (can be whatever you want, something to identify the version of the software that is running on the machine)
   - `INGEST_HOST=http://localhost:3001` (default for this setup)
5. Copy `config.example.json` to `copy.json`. List the Docker containers you want to observe and their corresponding versions. If you don't want to observe any, can be left as-is.
6. Copy `analysis-tasks.example.json` to `analysis-tasks.json`.
7. Start monitoring by running `npm run monitor`. Let this run for a while to have some measurement in the database.
8. To analyse the measurements:
   1. Adjust the analysis tasks within `analysis-tasks.json` as needed, e.g. adjust the time frames.
   2. Compute the insights by running `npm run calc`
   3. Open the Grafana dashboard by opening `http://localhost:3000/d/ednrbjho21khse/monitoring` (login with username `admin` and password `admin`) to see the computed insights.


## Limitations

Only macOS is currently supported with a battery that is either charging or discharging (i.e., not 100% full).
Other systems can be supported by extending `src/scripts/monitor.ts` as needed.
Also, measurements can be directly ingested into the database via the `/ingest` route of the Next.js application (default: `http://localhost:3001/ingest`).
