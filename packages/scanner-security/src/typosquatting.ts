import { distance } from "fastest-levenshtein";

export interface TyposquattingMatch {
  similarTo: string;
  distance: number;
}

const POPULAR_PACKAGES = [
  "lodash", "express", "react", "react-dom", "axios",
  "typescript", "webpack", "next", "vue", "angular",
  "moment", "dayjs", "chalk", "commander", "inquirer",
  "jest", "mocha", "vitest", "eslint", "prettier",
  "dotenv", "cors", "uuid", "debug", "semver",
  "glob", "minimatch", "yargs", "fs-extra", "rimraf",
  "body-parser", "cookie-parser", "jsonwebtoken", "bcrypt", "bcryptjs",
  "mongoose", "sequelize", "prisma", "knex", "pg",
  "mysql2", "redis", "ioredis", "mongodb", "sqlite3",
  "nodemon", "concurrently", "cross-env", "tsup", "esbuild",
  "rollup", "vite", "parcel", "turbo", "nx",
  "tailwindcss", "postcss", "sass", "less", "styled-components",
  "zod", "joi", "yup", "ajv", "class-validator",
  "rxjs", "immer", "zustand", "redux", "mobx",
  "socket.io", "ws", "graphql", "apollo-server", "fastify",
  "koa", "hapi", "restify", "micro", "polka",
  "sharp", "jimp", "multer", "formidable", "busboy",
  "nodemailer", "twilio", "aws-sdk", "firebase", "stripe",
];

const MAX_DISTANCE = 2;

export function checkTyposquatting(packageName: string): TyposquattingMatch | null {
  if (packageName.startsWith("@")) return null;

  for (const popular of POPULAR_PACKAGES) {
    if (packageName === popular) return null;
    const d = distance(packageName, popular);
    if (d > 0 && d <= MAX_DISTANCE) {
      return { similarTo: popular, distance: d };
    }
  }
  return null;
}
