import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from "@simplewebauthn/server";
import { env } from "../../config/env.js";
import { redisClient } from "../../config/redis.js";
import { ApiError } from "../../utils/ApiError.js";

const registrationChallengeKey = (email) => `webauthn:register:${email}`;
const loginChallengeKey = (email) => `webauthn:login:${email}`;

export const startRegistration = async (user) => {
  const options = await generateRegistrationOptions({
    rpName: env.WEBAUTHN_RP_NAME,
    rpID: env.WEBAUTHN_RP_ID,
    userName: user.email,
    userID: new TextEncoder().encode(user._id.toString()),
    attestationType: "none",
    excludeCredentials: user.trustedDevices.map((device) => ({
      id: device.credentialID,
      type: "public-key"
    }))
  });

  await redisClient.set(registrationChallengeKey(user.email), options.challenge, "EX", 300);
  return options;
};

export const finishRegistration = async (user, response, deviceName) => {
  const expectedChallenge = await redisClient.get(registrationChallengeKey(user.email));
  if (!expectedChallenge) throw new ApiError(400, "Registration challenge expired");

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: env.WEBAUTHN_ORIGIN,
    expectedRPID: env.WEBAUTHN_RP_ID
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new ApiError(400, "WebAuthn registration failed");
  }

  const { credential } = verification.registrationInfo;

  user.trustedDevices.push({
    credentialID: credential.id,
    deviceName,
    publicKey: Buffer.from(credential.publicKey).toString("base64"),
    counter: credential.counter,
    transports: response.response?.transports || [],
    webauthnUserId: user._id.toString(),
    lastUsed: new Date()
  });

  user.biometricEnabled = true;
  await user.save();
  await redisClient.del(registrationChallengeKey(user.email));
};

export const startAuthentication = async (user) => {
  if (!user.trustedDevices.length) throw new ApiError(400, "No biometric devices registered");

  const options = await generateAuthenticationOptions({
    rpID: env.WEBAUTHN_RP_ID,
    allowCredentials: user.trustedDevices.map((device) => ({
      id: device.credentialID,
      type: "public-key",
      transports: device.transports
    }))
  });

  await redisClient.set(loginChallengeKey(user.email), options.challenge, "EX", 300);
  return options;
};

export const finishAuthentication = async (user, response) => {
  const expectedChallenge = await redisClient.get(loginChallengeKey(user.email));
  if (!expectedChallenge) throw new ApiError(400, "Login challenge expired");

  const authenticator = user.trustedDevices.find((device) => device.credentialID === response.id);
  if (!authenticator) throw new ApiError(400, "Unknown biometric device");

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: env.WEBAUTHN_ORIGIN,
    expectedRPID: env.WEBAUTHN_RP_ID,
    credential: {
      id: authenticator.credentialID,
      publicKey: Buffer.from(authenticator.publicKey, "base64"),
      counter: authenticator.counter,
      transports: authenticator.transports
    }
  });

  if (!verification.verified) throw new ApiError(400, "Biometric verification failed");

  authenticator.counter = verification.authenticationInfo.newCounter;
  authenticator.lastUsed = new Date();
  await user.save();
  await redisClient.del(loginChallengeKey(user.email));
};
