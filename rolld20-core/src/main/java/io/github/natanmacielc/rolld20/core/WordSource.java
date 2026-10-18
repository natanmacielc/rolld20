package io.github.natanmacielc.rolld20.core;

/** Fonte de palavras uint32 (devolvidas como long em [0, 2^32)). */
@FunctionalInterface
interface WordSource {
    long next();
}
