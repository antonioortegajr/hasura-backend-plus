# Getting started

## Installation

### Nhost

The easiest way to deploy HBP is with the official [Nhost](https://nhost.io) managed service. Get your perfect configured backend with PostgreSQL, Hasura and Hasura Backend Plus and save yourself hours of maintenance per month.

All [Nhost](https://nhost.io) projects are built on open source software so you can make realtime web and mobile apps fast 🚀.

<div style="text-align:center;">
  <a href="https://nhost.io/register" target="_blank" >
    <img src="https://github.com/nhost/hasura-backend-plus/raw/master/docs/.vuepress/public/nhost-register-button.png" width="200px" />
  </a>
</div>

### Docker-Compose

Create the following `docker-compose.yaml` file, and modify the Hasura Admin Secret in both `graphql-engine` and `hasura-backend-plus` services.

<<< @/examples/simple-hasura-minio/docker-compose.yaml

Then start the services:

```shell
export HASURA_GRAPHQL_ADMIN_SECRET=<your Hasura Admin secret>
export S3_SECRET_ACCESS_KEY=<your Minio access key>
docker-compose up -d
```

Everything should be up and running. HBP is listening to `http://localhost:3000`, Hasura Graphql Engine is listening to `http://localhost:8080`.

You can then run the Hasura Console in following the [official instructions](https://hasura.io/docs/1.0/graphql/manual/hasura-cli/hasura_console.html).

<!-- If you want to get a more advanced example in using an S3-compatible Object Storage, see the [Minio example](recipes#minio) in the recipes. -->

### Standalone

You can also install HBP without any other service, and connect it to an existing Hasura server, and/or an S3 instance if you plan to use the storage features.
The easiest way is to pull and run a Docker container, but you can also run the service from the source code.

You will also need to make sure the HBP migrations and metadata are loaded in your Hasura instance, either in using the `AUTO_MIGRATE=true` environment variable, or in loading the migrations manually. Please see the [related configuration chapter](configuration.md#migrations) for further details.

#### Using Docker

```sh
docker run -d -p 3000:3000 \
  -e "HASURA_ENDPOINT=<your Hasura graphql endpoint>" \
  -e "HASURA_GRAPHQL_ADMIN_SECRET=<your Hasura admin secret>" \
  -e "JWT_KEY=<your JWT RSA256 key>" \
  nhost/hasura-backend-plus:latest
```

<!-- TODO You can also pass on the configuration to connect to an S3 service  -->

#### From the source code

```sh
git clone https://github.com/nhost/hasura-backend-plus.git
cd hasura-backend-plus
yarn
cp .env.example .env
yarn build
yarn start
```

## Registration

By default, anyone can register with an email address and a password:

```shell
curl -d '{"email":"real@emailadress.com", "password":"StrongPasswordNot1234"}' -H "Content-Type: application/json" -X POST http://localhost:3000/auth/register`
```

You can add some safeguards and limitations to the registration process like email verification, constraints on emails and passwords, or setting additional registration fields from your custom database schema. More information is available in the [registration configuration chapter](configuration.md#registration).

## Login

Once an user is registered, they can connect to HBP with the `/auth/login` endpoint:

```shell
curl -d '{"email":"real@emailadress.com", "password":"StrongPasswordNot1234"}' -H "Content-Type: application/json" -X POST http://localhost:3000/auth/login`
```

It will return the following payload:

```json
{
  "jwt_token": "<the user Hasura-compatible JWT>",
  "jwt_expires_in": "<the number of milliseconds of validity of the JWT>"
}
```

You'll find more details about how HBP handles the session and JWT in the [JWT section](#jwt).

## Multi-Factor Authentication

By default, any authenticted user can decide to add [TOTP](https://en.wikipedia.org/wiki/Time-based_One-time_Password_algorithm) multi-factor authentication (MFA). It will require the user to get a generator such as [Authy](https://authy.com/) or [Google Authenticator](https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2&hl=en).

### Generate

The first step to activate MFA is to generate a secret through the `/auth/mfa/generate` POST endpoint:

```shell
curl -H "Content-Type: application/json" -X POST http://localhost:3000/auth/mfa/generate`
```

It will return the following payload:

```json
{
  "otp_secret": "<the otp secret>",
  "image_url": "<the base64-encoded QR Code png image>"
}
```

The client now goes to its favorite MFA app (e.g. Google Authenticator) and enters its secret either manually or in using the QR-code generated by the server.

### Enable

Once the user fetched their OTP secret, they must generate a verification code and send it to HBP to complete the activation or MFA. The code is send to the `/auth/mfa/enable` POST endpoint:

```shell
curl -d '{"code":"<verification-code>"}' -H "Content-Type: application/json" -X POST http://localhost:3000/auth/mfa/enable`
```

The server should return a `204` HTTP code. The user login will now have an additional step as explained in the following section.

### Login

When an user enabled MFA, they still send their user/email credentials to `/auth/login`, but the payload will now become:

```json
{
  "mfa": true,
  "ticket": "<an automatically one-time only generated ticket>"
}
```

The next step to finish the authentication is to send back the ticket with the verification code from your favorite MFA app to `/auth/mfa/totp`:

```shell
curl -d '{"ticket":"<generated-ticket>", code":"<verification-code>"}' -H "Content-Type: application/json" -X POST http://localhost:3000/auth/mfa/totp`
```

The HBP session is then opened with the client, and the JWT is sent back as the payload:

```json
{
  "jwt_token": "<the user Hasura-compatible JWT>",
  "jwt_expires_in": "<the number of milliseconds of validity of the JWT>"
}
```

### Disable

## JWT

<!-- TODO Explain here:
- How JWT is structured
- How JWT is refreshed
- How to get the JWT
-> link to cookie specs in the configuration page -->

When the user logs in, HBP sets an HTTP-Only cookie to store session information and a refresh token.

::: warning
Never store a JWT in the local storage of the browser as it is prone to XSS attacks! Keep a short expiration period instead, and get a refreshed JWT through HBP.
:::

The `jwt_expires_in` indicates the maximum frequency in which the browser will need to refresh the JWT.

You can get a refreshed JWT throught the `/auth/token/refresh` GET endpoint:

```shell
curl -H "Content-Type: application/json" http://localhost:3000/auth/token/refresh`
```

It will return the same kind of payload as in `/auth/login`, with a new JWT:

```json
{
  "jwt_token": "<the user Hasura-compatible JWT>",
  "jwt_expires_in": "<the number of milliseconds of validity of the JWT>"
}
```

## Enable an OAuth provider

### Backend
Set the necessary environment variables on `docker-compose.yaml` under the `hasura-backend-plus` section. The OAuth Providers section from `.env.example` has a list of the supported providers and options. Make sure to set also the `PROVIDER_SUCCESS_REDIRECT` and `PROVIDER_FAILURE_REDIRECT` URLs to the frontend.

Client ID and a client secret are required to create a route for the following providers:

* google
* facebook
* github
* linkedin
* windowslive

Twitter requires consumerKey, consumerSecret, and cookieSecret
Apple requires client ID, client secret, key, and key ID

If these are not provided the provider route will not be created.


### Frontend
For OAuth login, redirect the user to `//hasura-backend-plus/auth/providers/{provider}` to perform the authentication. Upon success, the URL set in `PROVIDER_SUCCESS_REDIRECT` will be called back, with a `refresh_token` query parameter. Use this value to perform a GET on `//hasura-backend-plus/auth/token/refresh?refresh_token={refresh_token}` to obtain the response which contains the valid JWT.

Google set up example in recipies.md

## Change email

<!-- TODO in configuration? -->

## Reset password

<!-- TODO in configuration? -->

## Unregister

## Logout
