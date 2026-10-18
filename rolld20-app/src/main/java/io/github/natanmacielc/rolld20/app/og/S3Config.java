package io.github.natanmacielc.rolld20.app.og;

import io.smallrye.config.ConfigMapping;
import java.net.URI;
import java.util.Optional;

@ConfigMapping(prefix = "rolld20.s3")
public interface S3Config {

    String bucket();

    /** Só para S3 local (testes). Em produção fica vazio. */
    Optional<URI> endpointOverride();
}
