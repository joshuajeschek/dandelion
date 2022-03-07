# Dandelion Music Bot

This is a simple Discord Music Bot, made with TypeScript and Sapphire.

## Features
* play music in a voice channel
* queue
* skip voting
* save favourites (user based)

#### ENV files:
* `src/.env`: blueprint
* `src/.env.development.local`: development variables
* `src/.env.production.local`: production variables
* `src/prisma.env`: `DATABASE_URL` (ending with `...?schema=${PRISMA_SCHEMA}"`), with admin credentials
