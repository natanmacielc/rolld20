package io.github.natanmacielc.rolld20.app.beacon;

/** Um round do drand já validado (randomness = SHA-256(signature)). */
public record Beacon(long round, String randomness, String signature) {
}
