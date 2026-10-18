package io.github.natanmacielc.rolld20.app.beacon;

/** Nenhum endpoint do drand devolveu uma resposta válida. */
public class BeaconUnavailableException extends RuntimeException {

    public BeaconUnavailableException(String message) {
        super(message);
    }
}
