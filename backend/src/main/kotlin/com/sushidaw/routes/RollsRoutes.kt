package com.sushidaw.routes

import com.mongodb.client.model.Filters
import com.mongodb.client.model.Sorts
import com.sushidaw.db
import com.sushidaw.models.*
import com.sushidaw.userId
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.toList
import org.bson.Document
import java.util.*

fun Route.rollsRoutes() {

    val rolls = db.getCollection<Document>("rolls")

    // ── Save a completed sushi roll ───────────────────────────
    post("/api/rolls") {
        val userId = call.userId()
        val req    = call.receive<SaveRollRequest>()

        val id  = UUID.randomUUID().toString()
        val doc = Document().apply {
            put("id",            id)
            put("userId",        userId)
            put("rollName",      req.rollName)
            put("ingredients",   req.ingredients)
            put("rating",        req.rating)
            put("ratingLabel",   req.ratingLabel)
            put("canvasDataUrl", req.canvasDataUrl)
            put("beatId",        req.beatId)
            put("createdAt",     System.currentTimeMillis())
        }
        rolls.insertOne(doc)
        call.respond(OkResponse(id = id))
    }

    // ── Get roll history for current user ─────────────────────
    get("/api/rolls") {
        val userId = call.userId()
        @Suppress("UNCHECKED_CAST")
        val results = rolls
            .find(Filters.eq("userId", userId))
            .sort(Sorts.descending("createdAt"))
            .limit(50)  // last 50 rolls
            .map { doc ->
                SushiRoll(
                    id           = doc.getString("id"),
                    userId       = doc.getString("userId"),
                    rollName     = doc.getString("rollName"),
                    ingredients  = (doc["ingredients"] as? List<String>) ?: emptyList(),
                    rating       = doc.getInteger("rating", 1),
                    ratingLabel  = doc.getString("ratingLabel") ?: "",
                    canvasDataUrl= doc.getString("canvasDataUrl") ?: "",
                    beatId       = doc.getString("beatId") ?: "",
                    createdAt    = doc.getLong("createdAt") ?: 0L
                )
            }
            .toList()

        call.respond(results)
    }

    // ── Delete a roll ─────────────────────────────────────────
    delete("/api/rolls/{id}") {
        val userId = call.userId()
        val rollId = call.parameters["id"] ?: return@delete call.respond(HttpStatusCode.BadRequest)

        rolls.deleteOne(
            Filters.and(Filters.eq("id", rollId), Filters.eq("userId", userId))
        )
        call.respond(OkResponse())
    }
}