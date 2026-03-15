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
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.toList
import org.bson.Document
import java.util.*

fun Route.beatsRoutes() {

    val beats = db.getCollection<Document>("beats")

    // ── Save / upsert a beat ─────────────────────────────────
    post("/api/beats") {
        val userId = call.userId()
        val req    = call.receive<SaveBeatRequest>()

        val id  = UUID.randomUUID().toString()
        val now = System.currentTimeMillis()

        val doc = Document().apply {
            put("id",                   id)
            put("userId",               userId)
            put("name",                 req.name.ifBlank { "untitled beat" })
            put("bpm",                  req.bpm)
            put("numSteps",             req.numSteps)
            put("patternsJson",         req.patternsJson)
            put("channelInstancesJson", req.channelInstancesJson)
            put("createdAt",            now)
            put("updatedAt",            now)
        }
        beats.insertOne(doc)
        call.respond(OkResponse(id = id))
    }

    // ── List beats for current user ──────────────────────────
    get("/api/beats") {
        val userId  = call.userId()
        val results = beats
            .find(Filters.eq("userId", userId))
            .sort(Sorts.descending("updatedAt"))
            .map { doc ->
                BeatSummary(
                    id        = doc.getString("id"),
                    name      = doc.getString("name"),
                    bpm       = doc.getInteger("bpm", 128),
                    numSteps  = doc.getInteger("numSteps", 16),
                    createdAt = doc.getLong("createdAt") ?: 0L,
                    updatedAt = doc.getLong("updatedAt") ?: 0L
                )
            }
            .toList()

        call.respond(results)
    }

    // ── Load full beat by id ─────────────────────────────────
    get("/api/beats/{id}") {
        val userId  = call.userId()
        val beatId  = call.parameters["id"] ?: return@get call.respond(HttpStatusCode.BadRequest)

        val doc = beats.find(
            Filters.and(Filters.eq("id", beatId), Filters.eq("userId", userId))
        ).firstOrNull() ?: run {
            call.respond(HttpStatusCode.NotFound, ApiError("Beat not found"))
            return@get
        }

        call.respond(Beat(
            id                   = doc.getString("id"),
            userId               = doc.getString("userId"),
            name                 = doc.getString("name"),
            bpm                  = doc.getInteger("bpm", 128),
            numSteps             = doc.getInteger("numSteps", 16),
            patternsJson         = doc.getString("patternsJson"),
            channelInstancesJson = doc.getString("channelInstancesJson"),
            createdAt            = doc.getLong("createdAt") ?: 0L,
            updatedAt            = doc.getLong("updatedAt") ?: 0L
        ))
    }

    // ── Delete beat ──────────────────────────────────────────
    delete("/api/beats/{id}") {
        val userId = call.userId()
        val beatId = call.parameters["id"] ?: return@delete call.respond(HttpStatusCode.BadRequest)

        beats.deleteOne(
            Filters.and(Filters.eq("id", beatId), Filters.eq("userId", userId))
        )
        call.respond(OkResponse())
    }
}