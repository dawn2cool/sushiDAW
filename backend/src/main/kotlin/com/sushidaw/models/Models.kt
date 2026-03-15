package com.sushidaw.models

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray

// ── Auth ─────────────────────────────────────────────────────

@Serializable
data class User(
    val id: String,
    val username: String,
    val passwordHash: String,
    val producerTag: String = username,
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
data class RegisterRequest(
    val username: String,
    val password: String
)

@Serializable
data class LoginRequest(
    val username: String,
    val password: String
)

@Serializable
data class AuthResponse(
    val token: String,
    val userId: String,
    val username: String,
    val producerTag: String
)

@Serializable
data class UpdateTagRequest(
    val producerTag: String
)

// ── Beats ────────────────────────────────────────────────────

@Serializable
data class Beat(
    val id: String,
    val userId: String,
    val name: String,
    val bpm: Int,
    val numSteps: Int,
    val patternsJson: String,        // serialized JSON blob of the patterns array
    val channelInstancesJson: String, // serialized JSON blob of channelInstances
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

@Serializable
data class SaveBeatRequest(
    val name: String,
    val bpm: Int,
    val numSteps: Int,
    val patternsJson: String,
    val channelInstancesJson: String
)

@Serializable
data class BeatSummary(
    val id: String,
    val name: String,
    val bpm: Int,
    val numSteps: Int,
    val createdAt: Long,
    val updatedAt: Long
)

// ── Sushi Roll History ────────────────────────────────────────

@Serializable
data class SushiRoll(
    val id: String,
    val userId: String,
    val rollName: String,
    val ingredients: List<String>,
    val rating: Int,          // 1–5 stars
    val ratingLabel: String,  // "S-RANK SUSHI!" etc.
    val canvasDataUrl: String = "",  // base64 snapshot of the roll canvas
    val beatId: String = "",
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
data class SaveRollRequest(
    val rollName: String,
    val ingredients: List<String>,
    val rating: Int,
    val ratingLabel: String,
    val canvasDataUrl: String = "",
    val beatId: String = ""
)

// ── Generic responses ────────────────────────────────────────

@Serializable
data class ApiError(val error: String)

@Serializable
data class OkResponse(val ok: Boolean = true, val id: String = "")