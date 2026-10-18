package io.github.natanmacielc.rolld20.app.ledger;

public class InvalidRequestException extends RuntimeException {

    public InvalidRequestException(String message) {
        super(message);
    }
}
