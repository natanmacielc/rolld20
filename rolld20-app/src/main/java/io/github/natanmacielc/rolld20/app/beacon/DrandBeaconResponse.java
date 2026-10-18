package io.github.natanmacielc.rolld20.app.beacon;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** Corpo de /{chain}/public/{round|latest}. A ordem dos campos varia entre relays. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record DrandBeaconResponse(Long round, String randomness, String signature) {
}
