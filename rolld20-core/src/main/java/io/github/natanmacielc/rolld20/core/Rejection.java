package io.github.natanmacielc.rolld20.core;

/** Palavra descartada pela rejeição de viés: posição no fluxo (a partir de 0) e valor uint32. */
public record Rejection(long wordIndex, long value) {
}
