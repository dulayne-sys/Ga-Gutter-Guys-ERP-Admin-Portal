# Firebase Functions

TypeScript Cloud Functions for the ERP Admin Portal.

## Prerequisites

- Node.js 20+
- Firebase CLI authenticated to the target project

## Install

```bash
npm install
```

## Build

```bash
npm run build
```

## Local emulator

```bash
npm run serve
```

## Required secret

This code uses `defineSecret("MAPS_API_KEY")` for route optimization.

Set it before deploy:

```bash
firebase functions:secrets:set MAPS_API_KEY
```

## Deploy

```bash
npm run deploy
```
