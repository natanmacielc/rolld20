package io.github.natanmacielc.rolld20.app.beacon;

import io.quarkus.arc.DefaultBean;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import java.time.Clock;

@ApplicationScoped
public class ClockProducer {

    @Produces
    @DefaultBean
    @ApplicationScoped
    Clock clock() {
        return Clock.systemUTC();
    }
}
