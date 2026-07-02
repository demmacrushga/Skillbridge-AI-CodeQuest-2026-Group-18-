INSERT INTO career.career_paths (name, description) VALUES
  ('Software Engineer', 'Build software systems and applications'),
  ('Data Analyst', 'Analyse data and derive business insights'),
  ('Accountant', 'Financial reporting and management'),
  ('Electrical Engineer', 'Design and analyse electrical systems'),
  ('Civil Engineer', 'Design infrastructure and construction projects')
ON CONFLICT (name) DO NOTHING;
