package com.sushidaw

import com.mongodb.kotlin.client.coroutine.MongoClient
import com.mongodb.kotlin.client.coroutine.MongoDatabase
import com.sushidaw.routes.authRoutes
import com.sushidaw.routes.beatsRoutes
import com.sushidaw.routes.rollsRoutes
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.auth.jwt.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import kotlinx.serialization.json.Json

// ── Config from environment variables ────────────────────────
val MONGO_URI    = System.getenv("MONGO_URI")    ?: "mongodb+srv://arun:1243@cluster0.tj8xuiw.mongodb.net/?appName=Cluster0"
val JWT_SECRET   = System.getenv("JWT_SECRET")   ?: "sushidaw-secret-change-in-prod"
val JWT_ISSUER   = System.getenv("JWT_ISSUER")   ?: "sushidaw"
val JWT_AUDIENCE = System.getenv("JWT_AUDIENCE") ?: "sushidaw-users"
val PORT         = System.getenv("PORT")?.toIntOrNull() ?: 3000

// ── Shared MongoDB database instance ─────────────────────────
lateinit var db: MongoDatabase

fun main() {
    val mongoClient = MongoClient.create(MONGO_URI)
    db = mongoClient.getDatabase("sushidaw")

    embeddedServer(Netty, port = PORT) {
        install(ContentNegotiation) {
            json(Json {
                ignoreUnknownKeys = true
                prettyPrint = false
            })
        }

        // Allow the frontend (any origin in dev; lock down in prod)
        install(CORS) {
            allowMethod(HttpMethod.Options)
            allowMethod(HttpMethod.Get)
            allowMethod(HttpMethod.Post)
            allowMethod(HttpMethod.Put)
            allowMethod(HttpMethod.Delete)
            allowHeader(HttpHeaders.Authorization)
            allowHeader(HttpHeaders.ContentType)
            anyHost()   // TODO: restrict to your domain in production
        }

        // JWT auth
        install(Authentication) {
            jwt("jwt") {
                verifier(
                    JWT.require(Algorithm.HMAC256(JWT_SECRET))
                        .withIssuer(JWT_ISSUER)
                        .withAudience(JWT_AUDIENCE)
                        .build()
                )
                validate { credential ->
                    if (credential.payload.getClaim("userId").asString().isNotEmpty())
                        JWTPrincipal(credential.payload)
                    else null
                }
                challenge { _, _ ->
                    call.respond(HttpStatusCode.Unauthorized, mapOf("error" to "Invalid or expired token"))
                }
            }
        }

        // Global error handler
        install(StatusPages) {
            exception<Throwable> { call, cause ->
                call.respond(
                    HttpStatusCode.InternalServerError,
                    mapOf("error" to (cause.message ?: "Internal server error"))
                )
            }
        }

        routing {
            get("/health") { call.respond(mapOf("status" to "ok", "service" to "SushiDAW")) }
            authRoutes()
            authenticate("jwt") {
                beatsRoutes()
                rollsRoutes()
            }
        }
    }.start(wait = true)
}

// ── Helper: extract userId from JWT principal ─────────────────
fun ApplicationCall.userId(): String =
    principal<JWTPrincipal>()!!.payload.getClaim("userId").asString()