-- ============================================
-- 신규 법인 추가: Netherlands, DE, UK, Singapore
-- ============================================

-- InBody Netherlands
INSERT INTO subsidiaries (name, code, country, city, latitude, longitude, region) 
VALUES 
('InBody Netherlands', 'NLD', 'Netherlands', 'Amsterdam', 52.3676, 4.9041, 'Europe')
ON CONFLICT (code) DO NOTHING;

-- InBody DE (Germany)
INSERT INTO subsidiaries (name, code, country, city, latitude, longitude, region) 
VALUES 
('InBody DE', 'DEU', 'Germany', 'Berlin', 52.5200, 13.4050, 'Europe')
ON CONFLICT (code) DO NOTHING;

-- InBody UK
INSERT INTO subsidiaries (name, code, country, city, latitude, longitude, region) 
VALUES 
('InBody UK', 'GBR', 'United Kingdom', 'London', 51.5074, -0.1278, 'Europe')
ON CONFLICT (code) DO NOTHING;

-- InBody Singapore
INSERT INTO subsidiaries (name, code, country, city, latitude, longitude, region) 
VALUES 
('InBody Singapore', 'SGP', 'Singapore', 'Singapore', 1.3521, 103.8198, 'Asia-Pacific')
ON CONFLICT (code) DO NOTHING;

-- 확인
SELECT name, code, country, city, region FROM subsidiaries 
WHERE code IN ('NLD', 'DEU', 'GBR', 'SGP')
ORDER BY name;
