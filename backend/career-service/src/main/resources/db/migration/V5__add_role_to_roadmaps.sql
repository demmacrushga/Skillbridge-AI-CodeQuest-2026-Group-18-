ALTER TABLE career.roadmaps
    ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'STUDENT';

UPDATE career.roadmaps
SET role = 'STUDENT'
WHERE role IS NULL;
