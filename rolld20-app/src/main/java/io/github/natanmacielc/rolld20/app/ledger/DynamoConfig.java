package io.github.natanmacielc.rolld20.app.ledger;

import io.smallrye.config.ConfigMapping;
import java.net.URI;
import java.util.Optional;

@ConfigMapping(prefix = "rolld20.dynamodb")
public interface DynamoConfig {

    String table();

    /** Só para DynamoDB Local (testes e desenvolvimento). Em produção fica vazio. */
    Optional<URI> endpointOverride();
}
