package io.github.natanmacielc.rolld20.app.ledger;

/** O pedido assinado (mesmo requestId) já foi gravado nesta mesa. */
public class RequestReplayException extends RuntimeException {

    public RequestReplayException(String message) {
        super(message);
    }
}
