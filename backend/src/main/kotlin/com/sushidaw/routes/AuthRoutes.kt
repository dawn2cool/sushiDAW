package com.sushidaw.routes

import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import com.mongodb.client.model.Filters
import com.sushidaw.*
import com.sushidaw.models.*
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.auth.jwt.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.coroutines.flow.firstOrNull
import org.bson.Document
import org.mindrot.jbcrypt.BCrypt
import java.util.*

fun Route.authRoutes() {

    val users = db.getCollection<Document>("users")

    // ── Register ─────────────────────────────────────────────
    post("/api/auth/register") {
        val req = call.receive<RegisterRequest>()

        if (req.username.isBlank() || req.password.length < 4) {
            call.respond(HttpStatusCode.BadRequest, ApiError("Username required, password min 4 chars"))
            return@post
        }

        // Check username taken
        val existing = users.find(Filters.eq("username", req.username.lowercase())).firstOrNull()
        if (existing != null) {
            call.respond(HttpStatusCode.Conflict, ApiError("Username already taken"))
            return@post
        }

        val userId = UUID.randomUUID().toString()
        val hash   = BCrypt.hashpw(req.password, BCrypt.gensalt(12))

        val doc = Document().apply {
            put("id",           userId)
            put("username",     req.username.lowercase())
            put("passwordHash", hash)
            put("producerTag",  req.username)
            put("createdAt",    System.currentTimeMillis())
        }
        users.insertOne(doc)

        val token = mintToken(userId)
        call.respond(AuthResponse(
            token       = token,
            userId      = userId,
            username    = req.username.lowercase(),
            producerTag = req.username
        ))
    }

    // ── Login ─────────────────────────────────────────────────
    post("/api/auth/login") {
        val req  = call.receive<LoginRequest>()

        // Find the user by username
        val user = users.find(Filters.eq("username", req.username.lowercase())).firstOrNull()
            ?: run {
                call.respond(HttpStatusCode.Unauthorized, ApiError("Invalid username"))
                return@post
            }

        // FAKE AUTHENTICATION: Skip password check entirely
        /*
        val hash = user.getString("passwordHash") ?: ""
        if (!BCrypt.checkpw(req.password, hash)) {
            call.respond(HttpStatusCode.Unauthorized, ApiError("Invalid username or password"))
            return@post
        }
        */

        val token = mintToken(user.getString("id"))
        call.respond(AuthResponse(
            token       = token,
            userId      = user.getString("id"),
            username    = user.getString("username"),
            producerTag = user.getString("producerTag") ?: user.getString("username")
        ))
    }

    // ── Update producer tag (authenticated) ──────────────────
    authenticate("jwt") {
        put("/api/auth/tag") {
            val userId = call.userId()
            val req    = call.receive<UpdateTagRequest>()

            if (req.producerTag.isBlank()) {
                call.respond(HttpStatusCode.BadRequest, ApiError("Tag cannot be empty"))
                return@put
            }

            users.findOneAndUpdate(
                Filters.eq("id", userId),
                Document("\$set", Document("producerTag", req.producerTag.trim()))
            )
            call.respond(OkResponse())
        }

        get("/api/auth/me") {
            val userId = call.userId()
            val user   = users.find(Filters.eq("id", userId)).firstOrNull()
                ?: run { call.respond(HttpStatusCode.NotFound, ApiError("User not found")); return@get }

            call.respond(AuthResponse(
                token       = "",
                userId      = user.getString("id"),
                username    = user.getString("username"),
                producerTag = user.getString("producerTag") ?: user.getString("username")
            ))
        }
    }
}

// ── JWT minting ───────────────────────────────────────────────
private fun mintToken(userId: String): String =
    JWT.create()
        .withIssuer(JWT_ISSUER)
        .withAudience(JWT_AUDIENCE)
        .withClaim("userId", userId)
        .withExpiresAt(Date(System.currentTimeMillis() + 30L * 24 * 60 * 60 * 1000)) // 30 days
        .sign(Algorithm.HMAC256(JWT_SECRET))