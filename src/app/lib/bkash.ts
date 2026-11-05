import config from "../config";
import { AppError } from "../middleware/appError";
import { redisClient } from "./redis";

export const getBkashIdToken = async (): Promise<string> => {
  try {
    const idTokenKey = "bkash:IdToken";
    const refreshTokenKey = "bkash:refreshToken";

    const bkashIdToken = await redisClient.get(idTokenKey);
    const bkashIdTokenTTL = await redisClient.ttl(idTokenKey);

    const bkashRefreshToken = await redisClient.get(refreshTokenKey);
    const bkashRefreshTokenTTL = await redisClient.ttl(refreshTokenKey);

    if (bkashIdToken && bkashIdTokenTTL > 600) {
      return bkashIdToken;
    }

    if (bkashRefreshToken && bkashRefreshTokenTTL > 600) {
      const refreshTokenResponse = await fetch(
        `${config.bkash_sendbase_url}/tokenized/checkout/token/refresh`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            username: config.bkash_username,
            password: config.bkash_password,
          },
          body: JSON.stringify({
            app_key: config.bkash_app_key,
            app_secret: config.bkash_app_secret,
            refresh_token: bkashRefreshToken,
          }),
        }
      );

      if (!refreshTokenResponse.ok) {
        throw new AppError(502, "Bkash refresh token failed");
      }

      const refreshTokenResult = await refreshTokenResponse.json();

      if (
        typeof refreshTokenResult.id_token !== "string" ||
        !refreshTokenResult.id_token
      ) {
        throw new AppError(502, "Bkash ID token not found in refresh response");
      }

      const newIdToken: string = refreshTokenResult.id_token;

      await redisClient.set(idTokenKey, newIdToken, {
        expiration: {
          type: "EX",
          value: refreshTokenResult.expires_in || 3600,
        },
      });

      if (
        typeof refreshTokenResult.refresh_token === "string" &&
        refreshTokenResult.refresh_token
      ) {
        await redisClient.set(
          refreshTokenKey,
          refreshTokenResult.refresh_token,
          {
            expiration: {
              type: "EX",
              value: 60 * 60 * 24 * 28,
            },
          }
        );
      }

      return newIdToken;
    }

    const response = await fetch(
      `${config.bkash_sendbase_url}/tokenized/checkout/token/grant`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          username: config.bkash_username,
          password: config.bkash_password,
        },
        body: JSON.stringify({
          app_key: config.bkash_app_key,
          app_secret: config.bkash_app_secret,
        }),
      }
    );

    if (!response.ok) {
      throw new AppError(502, "Bkash access token grant failed");
    }

    const result = await response.json();

    if (
      typeof result.id_token !== "string" ||
      !result.id_token ||
      typeof result.refresh_token !== "string" ||
      !result.refresh_token
    ) {
      throw new AppError(502, "Invalid Bkash token response");
    }

    const newIdToken: string = result.id_token;

    await redisClient.set(idTokenKey, newIdToken, {
      expiration: {
        type: "EX",
        value: result.expires_in || 3600,
      },
    });

    await redisClient.set(refreshTokenKey, result.refresh_token, {
      expiration: {
        type: "EX",
        value: 60 * 60 * 24 * 28,
      },
    });

    return newIdToken;
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      502,
      error.message || "Something went wrong with Bkash"
    );
  }
};


