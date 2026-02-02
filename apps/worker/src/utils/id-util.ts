import { customAlphabet } from "nanoid";

export const idConfig = { length: 32 };

export const digitsAndLowercaseNanoId = customAlphabet("123456789abcdefghijkmnopqrstuvwxyz");

export const createId = () => digitsAndLowercaseNanoId(32);
