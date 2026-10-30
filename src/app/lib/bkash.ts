// import { response } from "express"
import config from "../config"
import { redisClient } from "./redis"
// import { redisClient } from "./radis"

export const getBkashIdToken = async()=>{
   try {

     const idTokenKey = 'bkash:IdToken'
     const refreshTokenKey = 'bkash:refreshToken'

     let bkashIdToken = await redisClient.get(idTokenKey)
     const bkashIdTokenTTL = await redisClient.ttl(idTokenKey)
     let bkashRefreshToken = await redisClient.get(refreshTokenKey)
     let bkashRefreshTokenTTL = await redisClient.ttl(refreshTokenKey)
     
     if ((bkashIdTokenTTL <= 600 || !bkashIdToken) && bkashRefreshToken && bkashRefreshTokenTTL > 600) {
        const refreshTokeneRsponse = await fetch(`${config.bkash_sendbase_url}/tokenized/checkout/token/refresh`,{
        method:"POST",
        headers:{
            "Content-Type": "application/json",
            Accept:"application/json",
             username: config.bkash_username,
             password: config.bkash_password,
        },
        body: JSON.stringify({
            app_key: config.bkash_app_key,
            app_secret: config.bkash_app_secret,
            refresh_token:bkashRefreshToken
        })

    })

        if (!refreshTokeneRsponse.ok) {
            throw new Error('Bkash RefreshToken  failed.....!')
        }

        const bkashRefreshTokenResult  = await refreshTokeneRsponse.json()
        bkashIdToken = bkashRefreshTokenResult.id_token as string

        await redisClient.set(idTokenKey,bkashIdToken,{
            expiration:{
                type:"EX",
                value: 60*60
            }
        })

        return bkashIdToken
     }

     if (bkashIdTokenTTL > 600) {
        return bkashIdToken
     }

     const response = await fetch(`${config.bkash_sendbase_url}/tokenized/checkout/token/grant`,{
        method:"POST",
        headers:{
            "Content-Type": "application/json",
              Accept:"application/json",
             username: config.bkash_username,
             password: config.bkash_password,
        },
        body: JSON.stringify({
            app_key: config.bkash_app_key,
            app_secret: config.bkash_app_secret
        })
    })

    if (!response.ok) {
        throw new Error('Bkash accessToken Grent failed.....!')
    }

    const result = await response.json()  

    await redisClient.set(idTokenKey,result.id_token,{
        expiration:{
            type:"EX",
            value:60*60  //1 hours
        }
    })
    await redisClient.set(refreshTokenKey,result.refresh_token,{
        expiration:{
            type:"EX",
            value:60*60*24 * 28  //28 days
        }
    })

    bkashIdToken = result.id_token
    return bkashIdToken
   } catch (error:any) {
    throw new Error('errors from bkash.ts file',error)
   }
}

