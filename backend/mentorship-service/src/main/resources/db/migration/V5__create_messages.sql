CREATE TABLE mentorship.messages (
    id        UUID PRIMARY KEY,
    pair_id   UUID          NOT NULL REFERENCES mentorship.mentorship_pairs (id),
    sender_id UUID          NOT NULL,
    body      VARCHAR(4000) NOT NULL,
    sent_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    read_at   TIMESTAMPTZ
);

CREATE INDEX idx_messages_pair ON mentorship.messages (pair_id, sent_at);
