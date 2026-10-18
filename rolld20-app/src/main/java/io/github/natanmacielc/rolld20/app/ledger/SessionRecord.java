package io.github.natanmacielc.rolld20.app.ledger;

import io.github.natanmacielc.rolld20.core.chain.ChainFormat;

/** Mesa. As criadas antes da chain-v2 não têm o atributo e são chain-v1 (só leitura). */
public record SessionRecord(String sessionId, String name, String createdAt, long headSeq, String headHash,
                            long nextNonce, ChainFormat chainFormat) {
}
